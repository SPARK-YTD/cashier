import { supabase } from "./supabase.js";
import { t, applyStaticTranslations, renderLanguageSwitcher } from "./delivery-i18n.js";
import { getRouteAlternatives, simplifyCoords, remainingRoute, haversineKm, formatDistance } from "./route-map.js";
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
  pollTimer = setInterval(loadDeliveryOrders, 10000);

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
            setMyPosition(pos.coords.latitude, pos.coords.longitude);
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
  if (routeState.open) refreshRouteOverlay();
};

function updateWelcomeText() {
  const nameEl = document.getElementById("driverNameSub");
  if (nameEl && currentDriverAccount?.name) {
    nameEl.textContent = t("welcome_sub", { name: currentDriverAccount.name });
  }
}

window.logoutDelivery = async function () {
  if (locationWatchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(locationWatchId);
  }
  releaseWakeLock();
  currentDriverAccountIdForWakeLock = null;
  try {
    await Promise.race([
      Promise.resolve(supabase.rpc("driver_logout", { p_token: driverToken() })),
      new Promise((r) => setTimeout(r, 1500))
    ]);
  } catch {}
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
      setMyPosition(pos.coords.latitude, pos.coords.longitude);
      const now = Date.now();
      if (now - lastLocationSentAt < LOCATION_UPDATE_INTERVAL) return;
      lastLocationSentAt = now;
      updateDriverLocation(accountId, pos.coords.latitude, pos.coords.longitude);
    },
    (err) => {
      console.warn("⚠️ LOCATION ERROR:", err);
      setLocationStatus("denied", t("location_denied"));
      if (err && err.code === 1) { gpsDenied = true; updateGpsBanner(); }   // 1 = رفض الصلاحية
    },
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
  );

  startHeartbeat(accountId);
}

/* ===============================
   نبض الاتصال + تنبيه توقف الموقع
   - watchPosition ما يطلق حدث إذا السائق واقف، فالمطعم يظنه انقطع.
     كل 45 ثانية (والصفحة ظاهرة) نطلب قراءة جديدة ونرسلها.
   - إذا ما وصلت قراءة لأكثر من 90 ثانية (أو الصلاحية مرفوضة) يطلع شريط أحمر للسائق.
================================ */
const HEARTBEAT_MS = 45000;
const GPS_STALE_MS = 90000;
const HEARTBEAT_MIN_SEND_GAP_MS = 40000;
let lastFixAt = 0;
let gpsDenied = false;
let heartbeatTimer = null;
let gpsCheckTimer = null;

function startHeartbeat(accountId) {
  lastFixAt = Date.now();          // نبدأ العد من لحظة تشغيل المشاركة
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (gpsCheckTimer) clearInterval(gpsCheckTimer);

  heartbeatTimer = setInterval(() => {
    if (document.visibilityState !== "visible" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyPosition(pos.coords.latitude, pos.coords.longitude);
        const now = Date.now();
        const fresh = !pos.timestamp || now - pos.timestamp < 60000;   // ما نرسل قراءة قديمة كأنها جديدة
        if (fresh && now - lastLocationSentAt >= HEARTBEAT_MIN_SEND_GAP_MS) {
          lastLocationSentAt = now;
          updateDriverLocation(accountId, pos.coords.latitude, pos.coords.longitude);
        }
      },
      (err) => { if (err && err.code === 1) { gpsDenied = true; updateGpsBanner(); } },
      { enableHighAccuracy: true, maximumAge: 20000, timeout: 15000 }
    );
  }, HEARTBEAT_MS);

  gpsCheckTimer = setInterval(updateGpsBanner, 10000);
}

function updateGpsBanner() {
  const el = document.getElementById("gpsWarn");
  if (!el || !lastFixAt) return;
  const stopped = gpsDenied || (Date.now() - lastFixAt > GPS_STALE_MS);
  el.textContent = t("gps_stopped");
  el.classList.toggle("show", stopped);
}

async function updateDriverLocation(accountId, lat, lng) {
  const { data: res, error } = await supabase.rpc("driver_set_location", {
    p_token: driverToken(),
    p_lat: lat,
    p_lng: lng
  });

  if (!error && res && res.ok === false && res.error === "NO_SESSION") {
    forceDriverRelogin();
    return;
  }

  if (error || (res && res.ok === false)) {
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

function driverToken() {
  return currentDriverAccount?.token || "";
}

function forceDriverRelogin() {
  sessionStorage.removeItem("delivery_session");
  location.href = "delivery-login.html";
}

async function loadDeliveryOrders() {
  const { data: rpcRes, error } = await supabase.rpc("driver_orders", { p_token: driverToken() });
  if (!error && rpcRes && rpcRes.ok === false) {
    forceDriverRelogin();
    return;
  }
  const data = rpcRes?.orders;

  if (error) {
    console.error("❌ LOAD DELIVERY ORDERS ERROR:", error);
    return;
  }

  deliveryOrders = data || [];
  renderDeliveryOrders();
  if (routeState.open) refreshRouteOverlay();
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
        hasLocation
          ? `<button type="button" class="map-btn" onclick="openRouteMap('${order.id}')">${t("route_btn")}</button>`
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
  const { data: res, error } = await supabase.rpc("driver_claim", {
    p_token: driverToken(),
    p_order: orderId
  });

  if (error) {
    alert(t("claim_fail") + error.message);
    return;
  }

  if (res && res.ok === false) {
    forceDriverRelogin();
    return;
  }

  if (!res || res.claimed !== true) {
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
    // ✅ paymentMethod ("cash" | "benefit") مجرد إشعار من السايق للكاشير - مو تسجيل
    // دفع رسمي (الكاشير هو اللي يسجل الدفع بنفسه من شاشته).
    const { data: res, error } = await supabase.rpc("driver_mark_delivered", {
      p_token: driverToken(),
      p_order: orderId,
      p_payment_note: paymentMethod || null
    });

    if (error) throw error;
    if (res && res.ok === false && res.error === "NO_SESSION") {
      forceDriverRelogin();
      return;
    }
    if (!res || res.ok !== true) throw new Error(res?.error || "NOT_ALLOWED");

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

// ✅ التحديث صار بالـpolling فقط (كل 10 ثواني): الـrealtime يحتاج صلاحية قراءة مباشرة
// على جدول الطلبات، وقفلناها عن المفتاح العام لحماية بيانات الزبائن.
function subscribeToDeliveryOrders() {}


/* ===============================
   خريطة المسار داخل الصفحة (بدل التحويل لقوقل ماب)
   - خريطة Leaflet + مسار فعلي على الطرق من OSRM (route-map.js)
   - موقع السائق من نفس watchPosition اللي يرسل موقعه للمطعم
   - النافذة خارج قائمة الطلبات، فتحديث القائمة كل 10 ثواني ما يدمرها
================================ */
let myPos = null;
const routeState = {
  open: false, orderId: null, map: null, driverMarker: null, customerMarker: null,
  chosenLine: null, altLines: [], seq: 0, fitted: false,
  savedLoaded: false, alts: [], altsOrigin: null, altsLoading: false,
  chosen: null,        // { coords, minutes, km, approx, saved }
  autoTried: false
};

function setMyPosition(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  myPos = { lat, lng, at: Date.now() };
  lastFixAt = Date.now();
  if (gpsDenied) gpsDenied = false;
  updateGpsBanner();
  if (routeState.open) refreshRouteOverlay();
}

function googleNavUrl(order) {
  return `https://www.google.com/maps/dir/?api=1&destination=${order.delivery_lat},${order.delivery_lng}&travelmode=driving`;
}

window.openRouteMap = function (orderId) {
  const order = deliveryOrders.find(o => o.id === orderId);
  if (!order || order.delivery_lat == null || order.delivery_lng == null) {
    alert(t("no_location_alert"));
    return;
  }
  // لو مكتبة الخريطة ما تحمّلت (ضعف نت) ما نترك السائق بدون وسيلة: نفتح قوقل مباشرة
  if (typeof L === "undefined") {
    window.open(googleNavUrl(order), "_blank", "noopener");
    return;
  }
  if (routeState.open) teardownRouteMap();

  const lat = Number(order.delivery_lat), lng = Number(order.delivery_lng);
  const overlay = document.getElementById("routeOverlay");
  overlay.classList.add("open");
  routeState.open = true;
  routeState.orderId = orderId;
  routeState.fitted = false;
  routeState.savedLoaded = false;
  routeState.alts = [];
  routeState.altsOrigin = null;
  routeState.altsLoading = false;
  routeState.chosen = null;
  routeState.autoTried = false;
  const seq = ++routeState.seq;

  const gBtn = document.getElementById("routeGoogleBtn");
  if (gBtn) gBtn.href = googleNavUrl(order);

  routeState.map = L.map("routeMapBox").setView([lat, lng], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap"
  }).addTo(routeState.map);

  const custIcon = L.divIcon({
    className: "",
    html: `<div style="background:#DC2626;color:white;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4);"><span style="transform:rotate(45deg);font-size:13px;">📦</span></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26]
  });
  routeState.customerMarker = L.marker([lat, lng], { icon: custIcon }).addTo(routeState.map);
  routeState.customerMarker.bindPopup(t("route_customer"));

  // لازم نخبر Leaflet بالحجم الفعلي بعد ما النافذة تظهر
  setTimeout(() => { routeState.map && routeState.map.invalidateSize(); }, 50);

  // زر رجوع الجوال/المتصفح يقفل الخريطة بدل ما يطلع من الصفحة
  try { history.pushState({ routeMap: true }, ""); } catch {}

  setRouteInfo(t("route_loading"));
  showRouteSaved(null);
  setRouteWarn(null);
  renderRouteChips();

  // أول شي: هل عندي مسار محفوظ لهذا الطلب؟ (يرجع حتى لو سكّر الصفحة وفتحها)
  loadSavedRoute(orderId, seq);
};

async function loadSavedRoute(orderId, seq) {
  let saved = null;
  try {
    const { data: res } = await supabase.rpc("driver_get_route", { p_token: driverToken(), p_order: orderId });
    if (res && res.ok === false && res.error === "NO_SESSION") { forceDriverRelogin(); return; }
    if (res && res.ok && Array.isArray(res.route) && res.route.length >= 2) {
      saved = {
        coords: res.route,
        minutes: Number(res.minutes) || 1,
        km: Number(res.km) || 0,
        approx: false,
        saved: true
      };
    }
  } catch (e) { console.warn("driver_get_route failed", e); }
  if (!routeState.open || seq !== routeState.seq) return;
  if (saved) routeState.chosen = saved;
  routeState.savedLoaded = true;
  refreshRouteOverlay();
}

function setRouteInfo(text, approxNote) {
  const el = document.getElementById("routeInfo");
  if (!el) return;
  el.textContent = text;
  if (approxNote) {
    const span = document.createElement("span");
    span.className = "approx";
    span.textContent = approxNote;
    el.appendChild(span);
  }
}

function setRouteWarn(text) {
  const el = document.getElementById("routeWarn");
  if (!el) return;
  el.textContent = text || "";
  el.classList.toggle("show", !!text);
}

function showRouteSaved(state) {   // null | "ok" | "fail"
  const el = document.getElementById("routeSaved");
  if (!el) return;
  el.classList.remove("show", "fail");
  if (!state) { el.textContent = ""; return; }
  el.textContent = state === "ok" ? t("route_saved") : t("route_save_fail");
  el.classList.add("show");
  if (state === "fail") el.classList.add("fail");
}

function ensureDriverMarker() {
  if (!myPos || !routeState.map) return;
  if (!routeState.driverMarker) {
    const youIcon = L.divIcon({
      className: "",
      html: `<div style="background:#2563EB;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.25),0 0 6px rgba(0,0,0,0.4);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
    routeState.driverMarker = L.marker([myPos.lat, myPos.lng], { icon: youIcon }).addTo(routeState.map);
    routeState.driverMarker.bindPopup(t("route_you"));
  } else {
    routeState.driverMarker.setLatLng([myPos.lat, myPos.lng]);
  }
}

// تستدعى مع كل تحديث موقع/قائمة: خفيفة (بدون أي طلب شبكة إلا أول مرة نجيب فيها البدائل)
function refreshRouteOverlay() {
  if (!routeState.open || !routeState.map) return;
  const order = deliveryOrders.find(o => o.id === routeState.orderId);
  if (!order) { teardownRouteMap(); return; }   // انوصل أو انشال من القائمة
  if (!routeState.savedLoaded) return;          // ننتظر نعرف إذا فيه مسار محفوظ

  const to = { lat: Number(order.delivery_lat), lng: Number(order.delivery_lng) };
  routeState.customerMarker.setLatLng([to.lat, to.lng]);
  ensureDriverMarker();

  // ما عندنا مسار مختار: نجيب البدائل أول ما يوصل الموقع، ونعتمد الأسرع تلقائياً (يقدر يغيره)
  if (!routeState.chosen && !routeState.autoTried && !routeState.altsLoading) {
    if (!myPos) { setRouteInfo(t("route_waiting_gps")); return; }
    routeState.autoTried = true;
    loadAlternatives(order, true);
    return;
  }
  if (!routeState.chosen) {
    if (!myPos) setRouteInfo(t("route_waiting_gps"));
    return;
  }
  drawChosen(order, to);
}

async function loadAlternatives(order, autoPick) {
  if (!myPos) return;
  const seq = routeState.seq;
  routeState.altsLoading = true;
  setRouteInfo(t("route_loading"));
  const from = { lat: myPos.lat, lng: myPos.lng };
  const to = { lat: Number(order.delivery_lat), lng: Number(order.delivery_lng) };
  let list = [];
  try { list = await getRouteAlternatives(from, to); } catch { list = []; }
  if (!routeState.open || seq !== routeState.seq) return;
  routeState.altsLoading = false;
  routeState.alts = list;
  routeState.altsOrigin = from;
  clearAltLines();
  renderRouteChips();
  if (list.length && autoPick) chooseAlt(0);
}

window.refreshRouteChoices = function () {
  if (!routeState.open || routeState.altsLoading) return;
  const order = deliveryOrders.find(o => o.id === routeState.orderId);
  if (!order) return;
  if (!myPos) { setRouteInfo(t("route_waiting_gps")); return; }
  loadAlternatives(order, true);
};

function clearAltLines() {
  if (routeState.map) routeState.altLines.forEach(l => { try { routeState.map.removeLayer(l); } catch {} });
  routeState.altLines = [];
}

function renderRouteChips() {
  const box = document.getElementById("routeAlts");
  const chips = document.getElementById("routeChips");
  if (!box || !chips) return;
  chips.textContent = "";
  const alts = routeState.alts;
  // البدائل محسوبة من نقطة انطلاق معينة؛ إذا ابتعد السائق عنها أكثر من 500 م ما عادت مفيدة
  const farFromOrigin = myPos && routeState.altsOrigin &&
    projectDistanceM(routeState.altsOrigin, myPos) > 500;
  const usable = alts.length > 0 && !(alts.length === 1 && alts[0].approx) && !farFromOrigin;
  box.classList.toggle("show", usable && alts.length > 1);
  if (!usable) return;
  alts.forEach((a, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (routeState.chosen && routeState.chosen.altIndex === i ? " sel" : "");
    b.dataset.alt = String(i);
    b.textContent = t("route_alt_label", { n: i + 1, m: a.minutes, d: formatDistance(a.distanceKm) });
    b.addEventListener("click", () => chooseAlt(i));
    chips.appendChild(b);
  });
}

function projectDistanceM(a, b) {
  return haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
}

let saveQueue = Promise.resolve();

async function chooseAlt(i) {
  const a = routeState.alts[i];
  const order = deliveryOrders.find(o => o.id === routeState.orderId);
  if (!a || !order || !routeState.open) return;
  const seq = routeState.seq;

  const coords = simplifyCoords(a.coords, 300);
  routeState.chosen = {
    coords, minutes: a.minutes, km: a.distanceKm, approx: !!a.approx,
    altIndex: i, saved: false
  };
  showRouteSaved(null);
  renderRouteChips();
  refreshRouteOverlay();

  if (a.approx) return;   // خط مستقيم تقريبي: ما نعرضه للمطعم كأنه مسار السائق

  // نرسل الحفظات بالترتيب عشان آخر اختيار هو اللي يستقر عند المطعم
  const prev = saveQueue;
  let release; saveQueue = new Promise(r => { release = r; });
  await prev;
  if (!routeState.open || seq !== routeState.seq) { release(); return; }
  try {
    const { data: res, error } = await supabase.rpc("driver_set_route", {
      p_token: driverToken(),
      p_order: order.id,
      p_coords: coords,
      p_minutes: Math.min(600, Math.max(1, a.minutes)),
      p_km: Math.min(500, Math.max(0, Number(a.distanceKm.toFixed(2))))
    });
    if (res && res.ok === false && res.error === "NO_SESSION") { forceDriverRelogin(); return; }
    if (!routeState.open || seq !== routeState.seq) return;
    if (error || !res || res.ok !== true) {
      console.warn("driver_set_route failed", error, res);
      showRouteSaved("fail");
      return;
    }
    if (routeState.chosen && routeState.chosen.altIndex === i) routeState.chosen.saved = true;
    showRouteSaved("ok");
  } catch (e) {
    console.warn("driver_set_route exception", e);
    if (routeState.open && seq === routeState.seq) showRouteSaved("fail");
  } finally {
    release();
  }
}

function drawChosen(order, to) {
  const c = routeState.chosen;
  const rem = myPos ? remainingRoute(c.coords, c.minutes, myPos) : null;
  const drawCoords = rem ? rem.coords : c.coords;

  if (routeState.chosenLine) { try { routeState.map.removeLayer(routeState.chosenLine); } catch {} }
  routeState.chosenLine = L.polyline(drawCoords, c.approx
    ? { color: "#2563EB", weight: 3, dashArray: "6, 8", opacity: 0.85 }
    : { color: "#2563EB", weight: 6, opacity: 0.9 }
  ).addTo(routeState.map);

  // البدائل غير المختارة: رمادي، وتنضغط لاختيارها (فقط وهي صالحة من نقطة الانطلاق)
  clearAltLines();
  const showAlts = routeState.alts.length > 1 && myPos && routeState.altsOrigin &&
    projectDistanceM(routeState.altsOrigin, myPos) <= 500;
  if (showAlts) {
    routeState.alts.forEach((a, i) => {
      if (c.altIndex === i) return;
      const l = L.polyline(a.coords, { color: "#94A3B8", weight: 5, opacity: 0.8 }).addTo(routeState.map);
      l.on("click", () => chooseAlt(i));
      routeState.altLines.push(l);
    });
    routeState.chosenLine.bringToFront();
  }
  renderRouteChips();

  if (!routeState.fitted) {
    routeState.fitted = true;
    const b = L.latLngBounds(drawCoords).extend([to.lat, to.lng]);
    if (myPos) b.extend([myPos.lat, myPos.lng]);
    routeState.map.fitBounds(b, { padding: [50, 50], maxZoom: 17, animate: false });
  }

  const minutes = rem ? rem.minutes : c.minutes;
  const km = rem ? rem.remainingKm : c.km;
  setRouteInfo(
    `${t("route_eta", { m: minutes })} · ${formatDistance(km)}`,
    c.approx ? t("route_approx") : null
  );
  if (c.saved) showRouteSaved("ok");
  setRouteWarn(rem && rem.offMeters > 300 ? t("route_off") : null);
}

window.recenterRouteMap = function () {
  if (!routeState.open || !routeState.map) return;
  const order = deliveryOrders.find(o => o.id === routeState.orderId);
  if (!order) return;
  const pts = [[Number(order.delivery_lat), Number(order.delivery_lng)]];
  if (myPos) pts.push([myPos.lat, myPos.lng]);
  if (pts.length === 1) routeState.map.setView(pts[0], 16, { animate: false });
  else routeState.map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 17, animate: false });
};

function teardownRouteMap() {
  routeState.seq++;
  routeState.open = false;
  routeState.orderId = null;
  if (routeState.map) { try { routeState.map.stop(); routeState.map.off(); routeState.map.remove(); } catch {} }
  routeState.map = null;
  routeState.driverMarker = null;
  routeState.customerMarker = null;
  routeState.chosenLine = null;
  routeState.altLines = [];
  routeState.alts = [];
  routeState.chosen = null;
  routeState.altsLoading = false;
  const overlay = document.getElementById("routeOverlay");
  if (overlay) overlay.classList.remove("open");
}

window.closeRouteMap = function () {
  if (history.state && history.state.routeMap) history.back();   // popstate يقفلها
  else teardownRouteMap();
};

window.addEventListener("popstate", () => {
  if (routeState.open) teardownRouteMap();
});
