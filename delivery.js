import { supabase } from "./supabase.js";
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
 *********************************/

let deliveryOrders = [];
let ordersChannel;
let pollTimer;

document.addEventListener("DOMContentLoaded", async () => {
  const session = sessionStorage.getItem("delivery_session");
  if (!session) {
    location.href = "delivery-login.html";
    return;
  }

  try {
    const account = JSON.parse(session);
    const nameEl = document.getElementById("driverNameSub");
    if (nameEl && account.name) {
      nameEl.textContent = `مرحباً ${account.name} - طلبات التوصيل بانتظار التسليم`;
    }
  } catch {}

  await loadDeliveryOrders();
  subscribeToDeliveryOrders();

  // ✅ شبكة أمان: بولينج كل 15 ثانية بنفس فلسفة app.js
  pollTimer = setInterval(loadDeliveryOrders, 15000);
});

window.logoutDelivery = function () {
  sessionStorage.removeItem("delivery_session");
  location.href = "delivery-login.html";
};

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
      is_delivered
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
      <div class="empty-state"><p>🚚 لا توجد طلبات توصيل بانتظار التسليم حالياً</p></div>
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
      order.delivery_block ? `مجمع ${order.delivery_block}` : null,
      order.delivery_road ? `طريق ${order.delivery_road}` : null,
      order.delivery_building ? `مبنى ${order.delivery_building}` : null
    ].filter(Boolean).join(" - ");

    const card = document.createElement("div");
    card.className = "delivery-card";
    card.id = `delivery-${order.id}`;
    card.innerHTML = `
      <div class="delivery-card-header">
        <span class="invoice-badge">🧾 فاتورة #${order.invoice_no ?? "—"}</span>
        <span class="time-badge">${minutesAgo <= 0 ? "الآن" : `منذ ${minutesAgo} دقيقة`}</span>
      </div>

      <div class="delivery-row">
        <strong>👤 ${escapeHtml(order.customer_name || "بدون اسم")}</strong>
        ${order.customer_phone ? `<a href="tel:${order.customer_phone}" class="phone-link">📞 ${order.customer_phone}</a>` : ""}
      </div>

      ${addressParts ? `<div class="delivery-row">📍 ${escapeHtml(addressParts)}</div>` : ""}

      ${
        mapLink
          ? `<a href="${mapLink}" target="_blank" rel="noopener" class="map-btn">🗺 فتح الموقع في خرائط قوقل</a>`
          : `<div class="delivery-row" style="color:#DC2626;">⚠️ العميل ما أرسل موقعه</div>`
      }

      ${order.notes ? `<div class="delivery-row notes">📝 ${escapeHtml(order.notes)}</div>` : ""}

      <div class="delivery-row fee-row">
        💰 رسوم التوصيل: ${Number(order.delivery_fee || 0).toFixed(3)} د.ب
      </div>

      <div class="delivery-row kitchen-status">
        ${
          order.kitchen_ready
            ? `<span class="badge ready">🟢 الطلب جاهز من المطبخ</span>`
            : `<span class="badge waiting">⏳ الطلب قيد التحضير</span>`
        }
      </div>

      <button class="delivered-btn" onclick="markDelivered('${order.id}')">✅ تم التوصيل</button>
    `;
    box.appendChild(card);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

window.markDelivered = async function (orderId) {
  if (!confirm("تأكيد أن الطلب وصل للعميل فعلاً؟")) return;

  const btn = document.querySelector(`#delivery-${orderId} .delivered-btn`);
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ جارِ التأكيد...";
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
    alert("❌ حصل خطأ أثناء تأكيد التوصيل: " + (err.message || ""));
    if (btn) {
      btn.disabled = false;
      btn.textContent = "✅ تم التوصيل";
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
