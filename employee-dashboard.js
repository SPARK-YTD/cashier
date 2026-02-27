import { supabase } from "./supabase.js";

/* ===============================
   Session Check
================================ */
const session = JSON.parse(sessionStorage.getItem("employee_session"));
if (!session) window.location.href = "employee-login.html";

document.getElementById("employeeName").textContent =
  `${session.name} (ID: ${session.code})`;

/* ===============================
   Helpers
================================ */

// 🔥 توحيد توقيت البحرين
function getBahrainNow() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3 * 60 * 60 * 1000));
}

function getDayRange() {
  const now = getBahrainNow();
  const start = new Date(now);
  start.setHours(0,0,0,0);

  const end = new Date(now);
  end.setHours(23,59,59,999);

  return { start, end };
}

function getMonthRange() {
  const now = getBahrainNow();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth()+1, 0, 23,59,59);
  return { start, end };
}

/* ===============================
   UI Events
================================ */

document.getElementById("timeFilter").addEventListener("change", () => {
  const value = document.getElementById("timeFilter").value;
  document.getElementById("customDateBox").style.display =
    value === "custom" ? "block" : "none";

  loadStats(); // 🔥 إعادة تحميل تلقائي
});

/* ===============================
   Main Function
================================ */

let currentRequest = 0; // 🔥 حماية من تضارب الاستعلامات

window.loadStats = async function () {

  const requestId = ++currentRequest;

  /* ===============================
     جلب أصناف الموظف
  ================================ */
  const { data: products } = await supabase
    .from("products")
    .select("id, name, category")
    .eq("partner_id", session.id);

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
    order:orders!inner(id, status, created_at, is_employee_order)
  `)
  .in("product_id", productIds)
  .eq("order.status", "completed")
  .eq("order.is_employee_order", false);

  if (filter === "today") {
    const { start, end } = getDayRange();
    query = query
      .gte("order.created_at", start.toISOString())
      .lte("order.created_at", end.toISOString());
  }

  if (filter === "month") {
    const { start, end } = getMonthRange();
    query = query
      .gte("order.created_at", start.toISOString())
      .lte("order.created_at", end.toISOString());
  }

  if (filter === "custom") {
    const fromDate = document.getElementById("dateFrom").value;
    const toDate = document.getElementById("dateTo").value;

    if (fromDate) {
      query = query.gte("order.created_at", new Date(fromDate).toISOString());
    }

    if (toDate) {
      const endCustom = new Date(toDate);
      endCustom.setHours(23,59,59,999);
      query = query.lte("order.created_at", endCustom.toISOString());
    }
  }

  const { data: items } = await query;

  if (requestId !== currentRequest) return;
  if (!items) return;

  /* ===============================
     الحسابات
  ================================ */

  let totalSales = 0;
  const uniqueOrders = new Set();
  const categoryStats = { food:0, drinks:0, sides:0 };
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
     تحديث الإحصائيات
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

  /* ===============================
     ترتيب وعرض الأصناف
  ================================ */

  const sortedProducts = Object.values(productStats)
    .sort((a,b) => b.qty - a.qty);

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