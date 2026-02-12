/* ===============================
   🔐 حماية شاشة المطبخ
================================ */
const kitchenAuth = sessionStorage.getItem("kitchen_auth");

if (!kitchenAuth) {
  const pass = prompt("🔐 أدخل كلمة سر المطبخ:");

  if (pass !== "1234") {
    alert("❌ كلمة المرور غير صحيحة");
    location.href = "about:blank";
    throw new Error("Unauthorized");
  }

  sessionStorage.setItem("kitchen_auth", "ok");
}

import { supabase } from "./supabase.js";

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {

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
  is_employee_order,
  is_delivery,
  customer_name,
  customer_phone,
  customer_area,
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
  let timeColor = "#E5E7EB";

if (diffMin >= 20) timeColor = "#EF4444";
else if (diffMin >= 10) timeColor = "#FACC15";

  // 🎨 لون الهيدر حسب نوع الطلب
  let headerColor = "#334155"; // عادي

  if (order.is_employee_order) {
    headerColor = "#7C3AED"; // بنفسجي للموظف
  } else if (order.is_delivery) {
    headerColor = "#2563EB"; // أزرق للتوصيل
  }

  const div = document.createElement("div");
  div.className = "kitchen-card";

  div.innerHTML = `
    <div class="k-header" style="background:${headerColor}">
      <div class="k-invoice">فاتورة #${order.invoice_no}</div>
      <div class="k-time" style="color:${timeColor}">
  ${diffMin} دقيقة
</div>

    ${
      order.is_delivery
        ? `
        <div style="font-size:13px;margin:6px 0;color:#1D4ED8">
          👤 ${order.customer_name || "-"}  
          📞 ${order.customer_phone || "-"}  
          📍 ${order.customer_area || "-"}
        </div>
        `
        : ""
    }

    ${
      order.is_employee_order
        ? `<div style="color:#7C3AED;font-weight:700;margin:6px 0">🧑‍🍳 طلب موظف</div>`
        : ""
    }

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
    .channel("kitchen-orders")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "orders"
      },
      () => {
        loadKitchenOrders();
      }
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "orders"
      },
      () => {
        loadKitchenOrders();
      }
    )
    .subscribe();
}