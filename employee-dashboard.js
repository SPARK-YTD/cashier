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

  // 1️⃣ جلب منتجات الموظف مع القسم
  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("id, category")
    .eq("partner_id", session.id);

  if (prodError || !products || products.length === 0) {
    document.getElementById("ordersCount").textContent = "0";
    document.getElementById("totalSales").textContent = "0.000 د.ب";
    return;
  }

  const productMap = {};
  products.forEach(p => {
    productMap[p.id] = p.category;
  });

  const productIds = products.map(p => p.id);

  // 2️⃣ جلب الطلبات المكتملة فقط
  // 2️⃣ جلب الطلبات المكتملة فقط + فلترة زمنية
// 2️⃣ جلب الطلبات المكتملة + فلترة زمنية صحيحة
const filter = document.getElementById("timeFilter")?.value || "all";

let startDate = null;

if (filter === "today") {
  const today = new Date();
  today.setHours(0,0,0,0);
  startDate = today.toISOString();
}

if (filter === "month") {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0,0,0,0);
  startDate = monthStart.toISOString();
}

let query = supabase
  .from("order_items")
  .select(`
    product_id,
    qty,
    price,
    order:orders!inner(id, status, created_at)
  `)
  .in("product_id", productIds)
  .eq("order.status", "completed");

if (startDate) {
  query = query.gte("order.created_at", startDate);
}

const { data: items, error: itemsError } = await query;

  if (itemsError || !items) return;

  let total = 0;
  const uniqueOrders = new Set();

  const categoryStats = {
    food: 0,
    drinks: 0,
    sides: 0
  };

  items.forEach(item => {
    total += item.qty * item.price;
    uniqueOrders.add(item.order.id);

    const category = productMap[item.product_id];
    if (categoryStats[category] !== undefined) {
      categoryStats[category] += item.qty;
    }
  });

  document.getElementById("ordersCount").textContent =
    uniqueOrders.size;

  document.getElementById("totalSales").textContent =
    total.toFixed(3) + " د.ب";

  // عرض إحصائيات الأقسام
  document.getElementById("foodCount").textContent =
    categoryStats.food;

  document.getElementById("drinksCount").textContent =
    categoryStats.drinks;

  document.getElementById("sidesCount").textContent =
    categoryStats.sides;
}

// تسجيل خروج
window.logoutEmployee = function () {
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};