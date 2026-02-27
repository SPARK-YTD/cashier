import { supabase } from "./supabase.js";

/* ===============================
   Session Check
================================ */
const session = JSON.parse(sessionStorage.getItem("employee_session"));
if (!session) window.location.href = "employee-login.html";

document.getElementById("employeeName").textContent =
  `${session.name} (ID: ${session.code})`;

/* ===============================
   UI Events
================================ */
document.getElementById("timeFilter").addEventListener("change", () => {
  const value = document.getElementById("timeFilter").value;
  document.getElementById("customDateBox").style.display =
    value === "custom" ? "block" : "none";

  loadStats();
});

/* ===============================
   Main Function
================================ */

let currentRequest = 0;

window.loadStats = async function () {

  const requestId = ++currentRequest;

  /* ===============================
     جلب أصناف الموظف
  ================================ */
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, category")
    .eq("partner_id", session.id);

  if (productsError) {
    console.error(productsError);
    return;
  }

  if (requestId !== currentRequest) return;

  document.getElementById("linkedProductsCount").textContent =
    products ? products.length : 0;

  const linkedList = document.getElementById("linkedProductsList");
  linkedList.innerHTML = "";

  products?.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    linkedList.appendChild(li);
  });

  if (!products || products.length === 0) return;

  const productIds = products.map(p => p.id);

  /* ===============================
     بناء الاستعلام حسب الفلتر
  ================================ */

  const filter = document.getElementById("timeFilter").value;

  let query = supabase
    .from("order_items")
    .select(`
      product_id,
      qty,
      price,
      order:orders!inner(
        id,
        status,
        created_at,
        is_employee_order,
        business_day_id
      )
    `)
    .in("product_id", productIds)
    .eq("order.status", "completed")
    .eq("order.is_employee_order", false);

  /* ========= فلتر اليوم ========= */
  if (filter === "today") {

    const { data: businessDay } = await supabase
      .from("business_days")
      .select("id")
      .eq("is_open", true)
      .single();

    if (!businessDay) {
      console.warn("لا يوجد يوم مفتوح");
      return;
    }

    query = query.eq("order.business_day_id", businessDay.id);
  }

  /* ========= فلتر الشهر ========= */
  if (filter === "month") {

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    query = query
      .gte("order.created_at", start.toISOString())
      .lte("order.created_at", end.toISOString());
  }

  /* ========= فلتر مخصص ========= */
  if (filter === "custom") {

    const fromDate = document.getElementById("dateFrom").value;
    const toDate = document.getElementById("dateTo").value;

    if (fromDate)
      query = query.gte("order.created_at", new Date(fromDate).toISOString());

    if (toDate) {
      const endCustom = new Date(toDate);
      endCustom.setHours(23, 59, 59, 999);
      query = query.lte("order.created_at", endCustom.toISOString());
    }
  }

  const { data: items, error: itemsError } = await query;

  if (itemsError) {
    console.error(itemsError);
    return;
  }

  if (requestId !== currentRequest) return;
  if (!items || items.length === 0) {

    document.getElementById("ordersCount").textContent = 0;
    document.getElementById("totalSales").textContent = "0.000 د.ب";
    document.getElementById("foodCount").textContent = 0;
    document.getElementById("drinksCount").textContent = 0;
    document.getElementById("sidesCount").textContent = 0;
    document.getElementById("productSalesList").innerHTML = "";

    return;
  }

  /* ===============================
     الحسابات
  ================================ */

  let totalSales = 0;
  const uniqueOrders = new Set();
  const categoryStats = { food: 0, drinks: 0, sides: 0 };
  const productStats = {};

  items.forEach(item => {

    const value = item.qty * item.price;
    totalSales += value;
    uniqueOrders.add(item.order.id);

    const product = products.find(p => p.id === item.product_id);
    if (!product) return;

    if (categoryStats[product.category] !== undefined) {
      categoryStats[product.category] += item.qty;
    }

    if (!productStats[product.id]) {
      productStats[product.id] = {
        name: product.name,
        qty: 0,
        value: 0
      };
    }

    productStats[product.id].qty += item.qty;
    productStats[product.id].value += value;
  });

  /* ===============================
     تحديث الواجهة
  ================================ */

  document.getElementById("ordersCount").textContent =
    uniqueOrders.size;

  document.getElementById("totalSales").textContent =
    totalSales.toFixed(3) + " د.ب";

  document.getElementById("foodCount").textContent =
    categoryStats.food;

  document.getElementById("drinksCount").textContent =
    categoryStats.drinks;

  document.getElementById("sidesCount").textContent =
    categoryStats.sides;

  const sortedProducts = Object.values(productStats)
    .sort((a, b) => b.qty - a.qty);

  const list = document.getElementById("productSalesList");
  list.innerHTML = "";

  sortedProducts.forEach((p, index) => {

    const li = document.createElement("li");

    if (index === 0) {
      li.innerHTML =
        `🏆 <strong>${p.name}</strong> — ${p.qty} قطعة — ${p.value.toFixed(3)} د.ب`;
    } else {
      li.textContent =
        `${p.name} — ${p.qty} قطعة — ${p.value.toFixed(3)} د.ب`;
    }

    list.appendChild(li);
  });

};

/* ===============================
   Auto Load
================================ */
window.loadStats();

/* ===============================
   Logout
================================ */
window.logoutEmployee = function () {
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};