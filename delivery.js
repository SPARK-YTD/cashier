import { supabase } from "./supabase.js";
import { t, applyStaticTranslations, renderLanguageSwitcher } from "./delivery-i18n.js";
window.supabase = supabase;

/*********************************
 * صفحة التوصيل | Get-Break Cashier
 * صفحة مستقلة تماماً عن الكاشير - حساب دخول خاص بالديلفري (delivery_accounts)
 * تعرض فقط طلبات التوصيل من العميل (QR) اللي:
 *   1) اتقبلت من الكاشير (approvePendingOrder)
 *   2) اتأكدت من الكاشير (تأكيد الطلب - customer_order_confirmed)
 *   3) لسا ما اتوصلت (is_delivered = false)
 * بدون عرض سعر الأصناف/الإجمالي - بس رسوم التوصيل + الموقع + بيانات العنوان
 *
 * ✅ "تم التوصيل" ما يقفل الفاتورة ولا يخفيها من الكاشير -
 * بس يعلّم إنها اتوصلت (is_delivered / delivered_at). الكاشير يشوفها لسا
 * بقائمة الطلبات الجارية مع شارة "🚚 وصل التوصيل"، ويقفلها هو بنفسه لاحقاً
 * بنفس آلية إتمام الفاتورة العادية.
 *
 * ✅ 3 لغات (عربي/English/اردو) عشان السواق أجانب - كل النصوص الديناميكية
 * تمر من دالة t() بملف delivery-i18n.js، واختيار اللغة يتحفظ بالمتصفح.
 *********************************/

let deliveryOrders = [];
let ordersChannel;
let pollTimer;
let locationWatchId = null;
let lastLocationSentAt = 0;
let currentDriverAccount = null;
const LOCATION_UPDATE_INTERVAL = 15000; // ما نرسل تحديث موقع أكثر من مرة كل 15 ثانية

// ✅ FIX (طلب المطعم): نحاول نخلي مشاركة الموقع تضل شغالة أطول ما يمكن.
// مهم نوضح حد الإمكانية: المتصفحات (كل المتصفحات) توقف تحديد الموقع
// تلقائياً لما الصفحة تصير بالخلفية (السايق يطلع من التاب/يقفل الشاشة)
// - هذا قيد من نظام الجوال نفسه لحماية البطارية والخصوصية، ما فيه طريقة
// موقع ويب عادي (بدون تطبيق حقيقي من المتجر) تتجاوزه بالكامل. اللي نقدر
// نسويه: (1) نخلي شاشة الجوال ما تنطفي وقت الصفحة مفتوحة (Wake Lock)
// (2) نرجّع الموقع فوراً أول ما السايق يرجع للتاب (visibilitychange)
// (3) نخليها PWA قابلة للتثبيت على الشاشة الرئيسية - يحسّن الثبات شوي
// خصوصاً بـAndroid، ويشتغل بدون شريط المتصفح.
let wakeLock = null;
let currentDriverAccountIdForWakeLock = null;

document.addEventListener("DOMContentLoaded", async () => {
  applyStaticTranslations();
  renderLanguageSwitcher("langSwitcher");
  registerDeliveryServiceWorker();
  setupInstallPrompt();

  const session = sessionStorage.getItem("delivery_session");
  if (!session) {
    location.href = "delivery-login.html";
    return;
  }

  let account = null;
  try {
    account = JSON.parse(session);
    currentDriverAccount = account;
    updateWelcomeText();
  } catch {}

  await loadDeliveryOrders();
  subscribeToDeliveryOrders();

  // ✅ شبكة أمان: بولينج كل 15 ثانية بنفس فلسفة app.js
  pollTimer = setInterval(loadDeliveryOrders, 15000);

  // ✅ مشاركة موقع السائق اللحظي عشان المطعم يقدر يشوف وينه
  if (account && account.id) {
    currentDriverAccountIdForWakeLock = account.id;
    startLocationSharing(account.id);
    requestWakeLock();
  }
});

// ✅ Wake Lock: يمنع شاشة الجوال من الانطفاء تلقائياً وقت الصفحة مفتوحة
// (يساعد يخلي تحديد الموقع شغال أطول). المتصفح يفكّه تلقائياً أول ما
// الصفحة تصير مخفية - لازم نطلبه من جديد أول ما ترجع تصير ظاهرة.
async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (err) {
    console.warn("⚠️ WAKE LOCK ERROR:", err);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // ✅ السايق رجع للصفحة - نرجّع الـWake Lock ونجيب موقعه فوراً
    // بدل ما ننتظر watchPosition يرجع يشتغل لحاله
    if (currentDriverAccountIdForWakeLock) {
      requestWakeLock();
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            lastLocationSentAt = Date.now();
            updateDriverLocation(currentDriverAccountIdForWakeLock, pos.coords.latitude, pos.coords.longitude);
          },
          () => {},
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
      }
    }
  }
});

// ✅ Service Worker - شرط أساسي عشان الصفحة تصير "قابلة للتثبيت" (PWA)
function registerDeliveryServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("delivery-sw.js").catch((err) => {
      console.warn("⚠️ SERVICE WORKER REGISTER ERROR:", err);
    });
  }
}

// ✅ زر "ثبّت التطبيق" يطلع بس بـAndroid/Chrome (اللي يدعم beforeinstallprompt).
// بـiOS ما فيه هالحدث إطلاقاً - نعرض تعليمات نصية بدلاً منه.
let deferredInstallPrompt = null;

function setupInstallPrompt() {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) return; // ✅ مثبتة أصلاً - ما نعرض شي

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    const btn = document.getElementById("installAppBtn");
    if (btn) btn.style.display = "inline-block";
  });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) {
    const iosHint = document.getElementById("iosInstallHint");
    if (iosHint) iosHint.style.display = "block";
  }
}

window.installDeliveryApp = async function () {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  const btn = document.getElementById("installAppBtn");
  if (btn) btn.style.display = "none";
};

// ✅ لما اللغة تتغير من الشريط، نعيد ترجمة كل شي (الثابت + المتحرك من JS)
window.__onLangChange = function () {
  applyStaticTranslations();
  renderLanguageSwitcher("langSwitcher");
  updateWelcomeText();
  renderDeliveryOrders();
};

function updateWelcomeText() {
  const nameEl = document.getElementById("driverNameSub");
  if (nameEl && currentDriverAccount?.name) {
    nameEl.textContent = t("welcome_sub", { name: currentDriverAccount.name });
  }
}

window.logoutDelivery = function () {
  if (locationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(locationWatchId);
  }
  releaseWakeLock();
  currentDriverAccountIdForWakeLock = null;
  sessionStorage.removeItem("delivery_session");
  location.href = "delivery-login.html";
};

/* ===============================
   مشاركة موقع السائق اللحظي
   (يرسل الموقع لجدول delivery_accounts كل ما يتحرك، بحد أقصى مرة كل 15 ثانية)
================================ */
function startLocationSharing(accountId) {
  if (!navigator.geolocation) {
    console.warn("⚠️ Location not supported");
    setLocationStatus("denied", t("location_no_support"));
    return;
  }

  locationWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const now = Date.now();
      if (now - lastLocationSentAt < LOCATION_UPDATE_INTERVAL) return;
      lastLocationSentAt = now;
      updateDriverLocation(accountId, pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      console.warn("⚠️ LOCATION ERROR:", err);
      setLocationStatus("denied", t("location_denied"));
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );
}

async function updateDriverLocation(accountId, lat, lng) {
  const { error } = await supabase
    .from("delivery_accounts")
    .update({
      current_lat: lat,
      current_lng: lng,
      location_updated_at: new Date().toISOString()
    })
    .eq("id", accountId);

  if (error) {
    console.error("❌ UPDATE LOCATION ERROR:", error);
    setLocationStatus("denied", t("location_send_fail"));
  } else {
    setLocationStatus("active", t("location_active"));
  }
}

let lastLocationState = null;

function setLocationStatus(state, text) {
  lastLocationState = state;
  const el = document.getElementById("locationStatus");
  if (!el) return;
  el.textContent = text;
  el.className = "location-status" + (state ? ` ${state}` : "");
}

async function loadDeliveryOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      invoice_no,
      created_at,
      timer_started_at,
      customer_name,
      customer_phone,
      delivery_block,
      delivery_road,
      delivery_building,
      delivery_lat,
      delivery_lng,
      delivery_fee,
      total,
      notes,
      kitchen_ready,
      status,
      is_delivery,
      customer_order_confirmed,
      is_delivered,
      assigned_driver_id,
      is_paid,
      payment_method
    `)
    .eq("is_delivery", true)
    .eq("customer_order_confirmed", true)
    .eq("is_delivered", false)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ LOAD DELIVERY ORDERS ERROR:", error);
    return;
  }

  deliveryOrders = data || [];
  renderDeliveryOrders();
}

function renderDeliveryOrders() {
  const box = document.getElementById("deliveryList");
  const countEl = document.getElementById("deliveryCount");
  countEl.textContent = deliveryOrders.length;

  if (deliveryOrders.length === 0) {
    box.innerHTML = `
      <div class="empty-state"><p>${t("empty_orders")}</p></div>
    `;
    return;
  }

  box.innerHTML = "";

  deliveryOrders.forEach(order => {
    const baseTime = order.timer_started_at || order.created_at;
    const minutesAgo = Math.max(0, Math.floor((Date.now() - new Date(baseTime).getTime()) / 60000));

    const hasLocation = order.delivery_lat != null && order.delivery_lng != null;
    const mapLink = hasLocation
      ? `https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`
      : null;

    const addressParts = [
      order.delivery_block ? `#${order.delivery_block}` : null,
      order.delivery_road ? `Rd ${order.delivery_road}` : null,
      order.delivery_building ? `Bldg ${order.delivery_building}` : null
    ].filter(Boolean).join(" - ");

    const isPaid = !!order.is_paid;

    const card = document.createElement("div");
    // ✅ لون مميز حسب حالة الدفع: paid = أخضر، unpaid = برتقالي/أحمر (نفس فكرة الكاشير)
    card.className = "delivery-card" + (isPaid ? " paid" : " unpaid");
    card.id = `delivery-${order.id}`;
    card.innerHTML = `
      <div class="delivery-card-header">
        <span class="invoice-badge">${t("invoice_prefix")}${order.invoice_no ?? "—"}</span>
        <span class="time-badge">${minutesAgo <= 0 ? t("time_now") : t("time_minutes_ago", { m: minutesAgo })}</span>
      </div>

      ${renderPaymentBadge(order, isPaid)}

      <div class="delivery-row">
        <strong>👤 ${escapeHtml(order.customer_name || t("no_name"))}</strong>
        ${order.customer_phone ? `<a href="tel:${order.customer_phone}" class="phone-link">📞 ${order.customer_phone}</a>` : ""}
      </div>

      ${addressParts ? `<div class="delivery-row">📍 ${escapeHtml(addressParts)}</div>` : ""}

      ${
        mapLink
          ? `<a href="${mapLink}" target="_blank" rel="noopener" class="map-btn">${t("open_map")}</a>`
          : `<div class="delivery-row" style="color:#DC2626;">${t("no_location")}</div>`
      }

      ${order.notes ? `<div class="delivery-row notes">📝 ${escapeHtml(order.notes)}</div>` : ""}

      ${(() => {
        // ✅ order.total = مبلغ الأصناف + رسوم التوصيل (نفس القيمة اللي يشوفها الكاشير).
        // نطرح رسوم التوصيل عشان نطلع "مبلغ الطلب" (الأصناف بس) منفصل عن رسوم التوصيل.
        const grandTotal = Number(order.total || 0);
        const deliveryFee = Number(order.delivery_fee || 0);
        const itemsAmount = Math.max(0, grandTotal - deliveryFee);
        return `
          <div class="delivery-row amount-row">
            ${t("order_amount_label")} ${itemsAmount.toFixed(3)} BHD
          </div>
          <div class="delivery-row fee-row">
            ${t("fee_label")} ${deliveryFee.toFixed(3)} BHD
          </div>
          ${
            // ✅ لو مدفوع أصلاً، ما فيه داعي نقول للسايق "حصّل" - يشوش عليه.
            // نعرض "المطلوب تحصيله" بس لما الطلب غير مدفوع.
            !isPaid
              ? `<div class="delivery-row collect-row">${t("collect_total_label")} ${grandTotal.toFixed(3)} BHD</div>`
              : ""
          }
        `;
      })()}

      <div class="delivery-row kitchen-status">
        ${
          order.kitchen_ready
            ? `<span class="badge ready">${t("kitchen_ready")}</span>`
            : `<span class="badge waiting">${t("kitchen_waiting")}</span>`
        }
      </div>

      ${renderClaimSection(order)}

      <button class="delivered-btn" onclick="markDelivered('${order.id}')">${t("delivered_btn")}</button>
    `;
    box.appendChild(card);
  });
}

// ✅ بادج حالة الدفع - يعتمد على is_paid اللي يسجله الكاشير حق المطعم وقت الطلب/التحصيل
function renderPaymentBadge(order, isPaid) {
  if (isPaid) {
    const methodKey =
      order.payment_method === "cash" ? "pay_method_cash" :
      order.payment_method === "benefit" ? "pay_method_benefit" :
      order.payment_method === "employee" ? "pay_method_employee" :
      null;
    const methodText = methodKey ? ` (${t("paid_via")}${t(methodKey)})` : "";
    return `<div class="payment-badge paid">${t("paid_badge")}${methodText}</div>`;
  }
  return `<div class="payment-badge unpaid">${t("unpaid_badge")}</div>`;
}

// ✅ زر "راح أوصلها أنا" - يربط الطلب بالسائق الحالي عشان صفحة تتبع السائقين
// ترسم خط بينه وبين موقع الزبون وتحسب وقت وصول تقديري
function renderClaimSection(order) {
  const myId = currentDriverAccount?.id;

  if (!order.assigned_driver_id) {
    return `<button class="claim-btn" onclick="claimOrder('${order.id}')">${t("claim_btn")}</button>`;
  }

  if (order.assigned_driver_id === myId) {
    return `<div class="claim-badge mine">${t("claim_mine")}</div>`;
  }

  return `<div class="claim-badge other">${t("claim_other")}</div>`;
}

window.claimOrder = async function (orderId) {
  if (!currentDriverAccount?.id) return;

  // ✅ نستخدم .is("assigned_driver_id", null) عشان لو سائق ثاني ضغط بنفس اللحظة، بس أول وحد ينجح
  const { data, error } = await supabase
    .from("orders")
    .update({ assigned_driver_id: currentDriverAccount.id })
    .eq("id", orderId)
    .is("assigned_driver_id", null)
    .select();

  if (error) {
    alert(t("claim_fail") + error.message);
    return;
  }

  if (!data || data.length === 0) {
    alert(t("claim_race"));
  }

  await loadDeliveryOrders();
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ✅ لو الطلب مو مدفوع، نوقف ونطلب من السايق يأكد طريقة الدفع (كاش/بطاقة)
// قبل ما نعلّمه "تم التوصيل". لو مدفوع أصلاً (سدده الزبون بالكاشير قبل الإرسال)
// نكمل مباشرة زي العادة بدون ما نلمس بيانات الدفع.
let currentDeliveryConfirmOrderId = null;

window.markDelivered = async function (orderId) {
  const order = deliveryOrders.find(o => o.id === orderId);
  if (!order) return;

  if (!order.is_paid) {
    openPaymentConfirmModal(orderId);
    return;
  }

  if (!confirm(t("delivered_confirm"))) return;
  await finalizeDelivery(orderId, null);
};

function openPaymentConfirmModal(orderId) {
  currentDeliveryConfirmOrderId = orderId;
  const overlay = document.getElementById("paymentConfirmOverlay");
  if (overlay) overlay.style.display = "flex";
}

window.closePaymentConfirmModal = function () {
  const overlay = document.getElementById("paymentConfirmOverlay");
  if (overlay) overlay.style.display = "none";
  currentDeliveryConfirmOrderId = null;
};

// ✅ method: "cash" أو "benefit" (بطاقة) - نفس القيم اللي يستخدمها الكاشير بالضبط
window.confirmPaymentAndDeliver = async function (method) {
  const orderId = currentDeliveryConfirmOrderId;
  if (!orderId) return;
  window.closePaymentConfirmModal();
  await finalizeDelivery(orderId, method);
};

async function finalizeDelivery(orderId, paymentMethod) {
  const btn = document.querySelector(`#delivery-${orderId} .delivered-btn`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = t("delivered_progress");
  }

  try {
    const updatePayload = {
      is_delivered: true,
      delivered_at: new Date().toISOString()
    };

    if (paymentMethod) {
      // ✅ FIX (حسب طلب المطعم): هذا مجرد إشعار من السايق للكاشير - مو تسجيل
      // دفع رسمي. ما نلمس is_paid ولا cash_amount ولا benefit_amount إطلاقاً
      // عشان ما يدخل غلط بالتقارير اليومية. الكاشير هو الوحيد اللي يسجل
      // الدفع الرسمي بنفسه من شاشته زي ما كان دايماً (زر "💰 تم الدفع").
      updatePayload.driver_payment_note = paymentMethod; // "cash" | "benefit" - إشعار بس
      updatePayload.driver_payment_note_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", orderId);

    if (error) throw error;

    await loadDeliveryOrders();

  } catch (err) {
    console.error("MARK DELIVERED ERROR:", err);
    alert(t("delivered_fail") + (err.message || ""));
    if (btn) {
      btn.disabled = false;
      btn.textContent = t("delivered_btn");
    }
  }
}

function subscribeToDeliveryOrders() {
  if (ordersChannel) {
    supabase.removeChannel(ordersChannel);
  }

  ordersChannel = supabase
    .channel("delivery-orders-channel")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => {
        loadDeliveryOrders();
      }
    )
    .subscribe((status) => {
      console.log("🔵 DELIVERY CHANNEL STATUS:", status);
      if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("⚠️ delivery channel dropped, reconnecting in 2s...");
        setTimeout(() => subscribeToDeliveryOrders(), 2000);
      }
    });
}
