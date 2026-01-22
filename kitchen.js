import { supabase } from "./supabase.js";

/* ===============================
   عناصر الصفحة
================================ */
const ordersBox = document.getElementById("kitchenOrders");
const overlay = document.getElementById("overlay");

/* ===============================
   تحميل الطلبات الجارية
================================ */
async function loadKitchenOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      invoice_no,
      created_at,
      timer_started_at,
      kitchen_ready,
      order_items (
        qty,
        item_name,
        extras_removed
      )
    `)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Kitchen load error:", error);
    return;
  }

  renderOrders(data || []);
}

/* ===============================
   رسم الطلبات
================================ */
function renderOrders(orders) {
  ordersBox.innerHTML = "";

  const now = Date.now();

  orders.forEach(order => {
    if (order.kitchen_ready) return; // ❌ لا نعرض الجاهز

    const baseTime = order.timer_started_at || order.created_at;
    const diffMin = Math.floor((now - new Date(baseTime)) / 60000);

    const card = document.createElement("div");
    card.className = "order-card";

    card.innerHTML = `
      <div class="order-header">
        <span>فاتورة #${order.invoice_no}</span>
        <span class="timer">⏱ ${diffMin} د</span>
      </div>

      <div class="items">
        ${order.order_items.map(i => `
          <span>• ${i.item_name} ×${i.qty}</span>
          ${
            i.extras_removed?.length
              ? `<span>  بدون: ${i.extras_removed.join("، ")}</span>`
              : ""
          }
        `).join("")}
      </div>

      <div class="actions">
        <button class="view-btn" onclick="viewOrder('${order.id}')">👁 عرض</button>
        <button class="ready-btn" onclick="markReady('${order.id}')">✅ جاهز</button>
      </div>
    `;

    ordersBox.appendChild(card);
  });
}

/* ===============================
   عرض الفاتورة (Overlay)
================================ */
window.viewOrder = async function (orderId) {
  const { data, error } = await supabase
    .from("order_items")
    .select("qty, item_name, extras_removed")
    .eq("order_id", orderId);

  if (error || !data) return;

  overlay.innerHTML = `
    <div class="overlay-box">
      <h3>🧾 تفاصيل الطلب</h3>

      <div class="overlay-items">
        ${data.map(i => `
          <div>
            ${i.item_name} ×${i.qty}
            ${
              i.extras_removed?.length
                ? `<div>بدون: ${i.extras_removed.join("، ")}</div>`
                : ""
            }
          </div>
        `).join("")}
      </div>

      <button class="close-btn" onclick="closeOverlay()">إغلاق</button>
    </div>
  `;

  overlay.classList.add("show");
};

window.closeOverlay = function () {
  overlay.classList.remove("show");
};

/* ===============================
   جاهز (مطبخ فقط)
================================ */
window.markReady = async function (orderId) {
  await supabase
    .from("orders")
    .update({ kitchen_ready: true })
    .eq("id", orderId);

  loadKitchenOrders(); // تحديث مباشر
};

/* ===============================
   REALTIME
================================ */
function subscribeKitchen() {
  supabase
    .channel("kitchen-orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      () => {
        loadKitchenOrders();
      }
    )
    .subscribe();
}

/* ===============================
   INIT
================================ */
loadKitchenOrders();
subscribeKitchen();