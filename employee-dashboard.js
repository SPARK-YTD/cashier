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

window.loadStats = async function () {

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

// 2️⃣ جلب الطلبات المكتملة + فلترة زمنية صحيحة
// 2️⃣ جلب كل الطلبات المكتملة
const { data: items, error: itemsError } = await supabase
  .from("order_items")
  .select(`
    product_id,
    qty,
    price,
    order:orders!inner(id, status, created_at)
  `)
  .in("product_id", productIds)
  .eq("order.status", "completed");

if (itemsError || !items) return;
console.log("DEBUG ITEMS:", items);

let total = 0;
const uniqueOrders = new Set();

const categoryStats = {
  food: 0,
  drinks: 0,
  sides: 0
};

const filter = document.getElementById("timeFilter")?.value || "all";

const todayStr = new Date().toISOString().slice(0, 10);      // YYYY-MM-DD
const monthStr = todayStr.slice(0, 7);                      // YYYY-MM

items.forEach(item => {

  const orderDateStr = item.order.created_at.slice(0, 10);  // YYYY-MM-DD
  const orderMonthStr = orderDateStr.slice(0, 7);

  // فلترة اليوم
  if (filter === "today" && orderDateStr !== todayStr) {
    return;
  }

  // فلترة الشهر
  if (filter === "month" && orderMonthStr !== monthStr) {
    return;
  }

  // فلترة الشهر
  if (filter === "month") {
    if (
      orderDate.getMonth() !== now.getMonth() ||
      orderDate.getFullYear() !== now.getFullYear()
    ) {
      return;
    }
  }

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