import { supabase } from "./supabase.js";

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  // 🔐 تأكد من تسجيل الدخول
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "login.html";
    return;
  }

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
      kitchen_ready,
      order_items (
        qty,
        item_name,
        extras_removed
      )
    `)
    .eq("status", "active")
    .eq("kitchen_ready", false)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Kitchen load error:", error);
    return;
  }

  renderKitchenOrders(data || []);
}

/* ===============================
   رسم الطلبات (عرض احترافي)
================================ */
function renderKitchenOrders(orders) {
  const box = document.getElementById("kitchenOrders");
  if (!box) return;

  box.innerHTML = "";

  const now = Date.now();

  if (orders.length === 0) {
    box.innerHTML = `<p style="text-align:center;font-size:18px">لا توجد طلبات حاليًا</p>`;
    return;
  }

  orders.forEach(order => {
    const baseTime = order.timer_started_at || order.created_at;
    const diffMin = Math.floor((now - new Date(baseTime)) / 60000);

    const div = document.createElement("div");
    div.className = "kitchen-card";

    div.innerHTML = `
      <div class="k-header">
        <div class="k-invoice">فاتورة #${order.invoice_no}</div>
        <div class="k-time">${diffMin} دقيقة</div>
      </div>

      <div class="k-items">
        ${order.order_items.map(item => `
          <div class="k-item">
            <div class="k-name">${item.item_name}</div>
            <div class="k-qty">× ${item.qty}</div>
            ${
              item.extras_removed?.length
                ? `<div class="k-extras">بدون: ${item.extras_removed.join("، ")}</div>`
                : ""
            }
          </div>
        `).join("")}
      </div>

      <button class="k-ready-btn" onclick="markKitchenReady('${order.id}')">
        ✅ جاهز
      </button>
    `;

    box.appendChild(div);
  });
}

/* ===============================
   زر جاهز (يحذف من المطبخ فقط)
================================ */
window.markKitchenReady = async function (orderId) {
  const { error } = await supabase
    .from("orders")
    .update({ kitchen_ready: true })
    .eq("id", orderId);

  if (!error) {
    loadKitchenOrders(); // 🔥 تحديث فوري مضمون
  } else {
    alert("❌ فشل تحديث حالة المطبخ");
    console.error(error);
  }
};
/* ===============================
   REALTIME – بدون رفرش
================================ */
function subscribeKitchenOrders() {
  supabase
    .channel("kitchen-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "orders" },
      loadKitchenOrders
    )
    .subscribe();
}