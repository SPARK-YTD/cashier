import { supabase } from "./supabase.js";

// جلب بيانات الجلسة
const session = JSON.parse(sessionStorage.getItem("employee_session"));

if (!session) {
  window.location.href = "employee-login.html";
}

// عرض الاسم
document.getElementById("employeeName").textContent =
  `${session.name} (ID: ${session.code})`;

// تعريف الدالة أولاً
window.loadStats = async function () {

  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("id, name, category")
    .eq("partner_id", session.id);

  if (prodError || !products || products.length === 0) {
    document.getElementById("ordersCount").textContent = "0";
    document.getElementById("totalSales").textContent = "0.000 د.ب";
    document.getElementById("foodCount").textContent = 0;
    document.getElementById("drinksCount").textContent = 0;
    document.getElementById("sidesCount").textContent = 0;
    return;
  }

  const productMap = {};
  products.forEach(p => {
    productMap[p.id] = p.category;
  });

  const productIds = products.map(p => p.id);
  // عرض عدد وأسماء الأصناف المرتبطة
document.getElementById("linkedProductsCount").textContent =
  products.length + " صنف";

const list = document.getElementById("linkedProductsList");
list.innerHTML = "";

products.forEach(p => {
  const li = document.createElement("li");
  li.textContent = p.name || "صنف";
  list.appendChild(li);
});

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

  let total = 0;
  const uniqueOrders = new Set();

  const categoryStats = {
    food: 0,
    drinks: 0,
    sides: 0
  };

  const filter = document.getElementById("timeFilter")?.value || "all";

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthStr = todayStr.slice(0, 7);

  items.forEach(item => {

    const orderDateStr = item.order.created_at.slice(0, 10);
    const orderMonthStr = orderDateStr.slice(0, 7);

    if (filter === "today" && orderDateStr !== todayStr) return;
    if (filter === "month" && orderMonthStr !== monthStr) return;

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
};

// الآن نناديها بعد تعريفها
window.loadStats();

// تسجيل خروج
window.logoutEmployee = function () {
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};