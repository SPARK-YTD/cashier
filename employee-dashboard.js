import { supabase } from "./supabase.js";

// جلب بيانات الجلسة
const session = JSON.parse(sessionStorage.getItem("employee_session"));

if (!session) {
  window.location.href = "employee-login.html";
}

// عرض الاسم
document.getElementById("employeeName").textContent =
  `${session.name} (ID: ${session.code})`;

loadStats();

async function loadStats() {

  // 1️⃣ جلب منتجات الموظف
  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("id")
    .eq("partner_id", session.id);

  if (prodError || !products || products.length === 0) {
    document.getElementById("ordersCount").textContent = "0";
    document.getElementById("totalSales").textContent = "0.000 د.ب";
    return;
  }

  const productIds = products.map(p => p.id);

  // 2️⃣ جلب الأصناف المباعة المرتبطة بطلبات مكتملة
  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select(`
      qty,
      price,
      order:orders!inner(status)
    `)
    .in("product_id", productIds)
    .eq("order.status", "completed");

  if (itemsError || !items) {
    document.getElementById("ordersCount").textContent = "0";
    document.getElementById("totalSales").textContent = "0.000 د.ب";
    return;
  }

  // 3️⃣ حساب الإحصائيات
  const uniqueOrders = new Set();
  let total = 0;

  items.forEach(item => {
    total += item.qty * item.price;
  });

  // عدد الطلبات الفريدة
  items.forEach(item => {
    if (item.order) {
      uniqueOrders.add(item.order.id);
    }
  });

  document.getElementById("ordersCount").textContent =
    uniqueOrders.size;

  document.getElementById("totalSales").textContent =
    total.toFixed(3) + " د.ب";
}

// تسجيل خروج
window.logoutEmployee = function () {
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};