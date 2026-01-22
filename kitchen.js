import { supabase } from "./supabase.js";

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadKitchenOrders();
  subscribeKitchenOrders();
});

/* ===============================
   تحميل طلبات المطبخ
================================ */
async function loadKitchenOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      invoice_no,
      created_at,
      timer_started_at,
      kitchen_status,
      order_items (
        qty,
        item_name,
        extras_removed
      )
    `)
    .eq("status", "active")
    .in("kitchen_status", ["new", "preparing"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error(error);
    return;
  }

  renderKitchenOrders(data || []);
}

/* ===============================
   رسم الطلبات
================================ */
function renderKitchenOrders(orders) {
  const box = document.getElementById("kitchenOrders");
  box.innerHTML = "";

  const now = Date.now();

  orders.forEach(order => {
    const baseTime = order.timer_started_at || order.created_at;
    const diffMin = Math.floor((now - new Date(baseTime)) / 60000);

    const div = document.createElement("div");
    div.className = "kitchen-order";

    div.innerHTML = `
      <div class="kitchen-header">
        <strong>فاتورة #${order.invoice_no}</strong>
        <span>${diffMin} دقيقة</span>
      </div>

      <div class="kitchen-items">
        ${order.order_items.map(i => `
          <div class="k-item">
            <strong>${i.item_name}</strong>
            ${i.extras_removed?.length
              ? `<div class="extras">بدون: ${i.extras_removed.join("، ")}</div>`
              : ""}
            <div class="qty">× ${i.qty}</div>
          </div>
        `).join("")}
      </div>

      <div class="kitchen-actions">
        ${
          order.kitchen_status === "new"
            ? `<button onclick="startPreparing('${order.id}')">▶️ بدء التحضير</button>`
            : `<button onclick="markReady('${order.id}')">✅ جاهز</button>`
        }
      </div>
    `;

    box.appendChild(div);
  });
}

/* ===============================
   أزرار المطبخ
================================ */
window.startPreparing = async id => {
  await supabase.from("orders")
    .update({ kitchen_status: "preparing" })
    .eq("id", id);
};

window.markReady = async id => {
  await supabase.from("orders")
    .update({ kitchen_status: "ready" })
    .eq("id", id);
};

/* ===============================
   REALTIME
================================ */
function subscribeKitchenOrders() {
  supabase
    .channel("kitchen-orders")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      loadKitchenOrders
    )
    .subscribe();
}