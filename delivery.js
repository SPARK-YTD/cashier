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

document.addEventListener("DOMContentLoaded", async () => {
  applyStaticTranslations();
  renderLanguageSwitcher("langSwitcher");

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
    startLocationSharing(account.id);
  }
});

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
      notes,
      kitchen_ready,
      status,
      is_delivery,
      customer_order_confirmed,
      is_delivered,
      assigned_driver_id
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

    const card = document.createElement("div");
    card.className = "delivery-card";
    card.id = `delivery-${order.id}`;
    card.innerHTML = `
      <div class="delivery-card-header">
        <span class="invoice-badge">${t("invoice_prefix")}${order.invoice_no ?? "—"}</span>
        <span class="time-badge">${minutesAgo <= 0 ? t("time_now") : t("time_minutes_ago", { m: minutesAgo })}</span>
      </div>

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

      <div class="delivery-row fee-row">
        ${t("fee_label")} ${Number(order.delivery_fee || 0).toFixed(3)} BHD
      </div>

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

window.markDelivered = async function (orderId) {
  if (!confirm(t("delivered_confirm"))) return;

  const btn = document.querySelector(`#delivery-${orderId} .delivered-btn`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = t("delivered_progress");
  }

  try {
    // ✅ بس نعلّم إنها اتوصلت - ما نلمس status ولا is_paid
    // عشان الطلب يبقى ظاهر بالكاشير للإقفال المحاسبي العادي
    const { error } = await supabase
      .from("orders")
      .update({
        is_delivered: true,
        delivered_at: new Date().toISOString()
      })
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
};

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
