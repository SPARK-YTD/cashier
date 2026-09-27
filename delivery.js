import { supabase } from "./supabase.js";
window.supabase = supabase;

/*********************************
 * صفحة التوصيل | Get-Break Cashier
 * تعرض فقط طلبات التوصيل من العميل (QR) اللي:
 *   1) اتقبلت من الكاشير (approvePendingOrder)
 *   2) اتأكدت من الكاشير (تأكيد الطلب - customer_order_confirmed)
 *   3) لسا نشطة (status = active)
 * بدون عرض سعر الأصناف/الإجمالي - بس رسوم التوصيل + الموقع + بيانات العنوان
 *********************************/

let currentBusinessDay = null;
let deliveryOrders = [];
let ordersChannel;
let pollTimer;

async function getOpenBusinessDay() {
  const { data, error } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ Error fetching open day:", error);
    return null;
  }
  return data;
}

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "login.html";
    return;
  }

  currentBusinessDay = await getOpenBusinessDay();

  if (!currentBusinessDay) {
    document.getElementById("deliveryList").innerHTML = `
      <div class="empty-state"><p>⚠️ لا يوجد يوم عمل مفتوح حالياً</p></div>
    `;
    return;
  }

  await loadDeliveryOrders();
  subscribeToDeliveryOrders();

  // ✅ شبكة أمان: بولينج كل 15 ثانية بنفس فلسفة app.js
  // (لو انقطع الـ realtime لأي سبب، الصفحة تبقى محدثة)
  pollTimer = setInterval(loadDeliveryOrders, 15000);
});

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
      is_paid,
      total,
      is_delivery,
      customer_order_confirmed,
      is_delivered,
      business_day_id
    `)
    .eq("is_delivery", true)
    .eq("customer_order_confirmed", true)
    .eq("status", "active")
    .eq("business_day_id", currentBusinessDay.id)
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
    const { data: freshOrder, error: fetchErr } = await supabase
      .from("orders")
      .select("id, status, is_paid, total")
      .eq("id", orderId)
      .single();

    if (fetchErr || !freshOrder) throw fetchErr || new Error("الطلب غير موجود");

    if (freshOrder.status === "completed") {
      alert("✔ هذا الطلب مكتمل مسبقاً");
      await loadDeliveryOrders();
      return;
    }

    const updates = {
      is_delivered: true,
      delivered_at: new Date().toISOString(),
      status: "completed",
      closed_at: new Date().toISOString(),
      kitchen_ready: true
    };

    // ✅ طلبات توصيل العميل (QR) تُدفع نقداً عند التسليم (COD)
    // إذا ما كانت مسجلة كمدفوعة مسبقاً من الكاشير
    if (!freshOrder.is_paid) {
      updates.is_paid = true;
      updates.payment_method = "cash";
      updates.cash_amount = freshOrder.total;
      updates.benefit_amount = 0;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updates)
      .eq("id", orderId);

    if (updateError) throw updateError;

    // ⏭️ لا نخصم من المخزون - كل طلبات هذه الصفحة هي توصيل عميل (QR) بقرار صاحب المشروع
    console.log("⏭️ تخطي خصم المخزون - طلب توصيل عميل (QR)");

    await processEmployeePayout(orderId);
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

// نسخة مطابقة لدالة app.js عشان عمولات الموظفين تنحسب بنفس الطريقة
// حتى لو الطلب اتقفل من صفحة التوصيل بدل الكاشير
async function processEmployeePayout(orderId) {
  try {
    const { data: items } = await supabase
      .from("order_items")
      .select("id, product_id, qty, price")
      .eq("order_id", orderId);

    if (!items) return;

    for (const item of items) {
      const saleTotal = Number(item.price) * Number(item.qty);

      const { data: productEmployees } = await supabase
        .from("product_employees")
        .select("employee_id, commission_percent")
        .eq("product_id", item.product_id);

      if (!productEmployees || productEmployees.length === 0) continue;

      for (const pe of productEmployees) {
        const payout = saleTotal * (Number(pe.commission_percent) / 100);

        const { data: cycle } = await supabase
          .from("employee_cycles")
          .select("id")
          .eq("employee_id", pe.employee_id)
          .eq("status", "open")
          .maybeSingle();

        if (!cycle) continue;

        await supabase.from("employee_sales").insert({
          employee_id: pe.employee_id,
          product_id: item.product_id,
          order_item_id: item.id,
          cycle_id: cycle.id,
          quantity: item.qty,
          sale_price: item.price,
          payout_amount: payout
        });
      }
    }
  } catch (err) {
    console.error("PAYOUT ERROR:", err);
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
