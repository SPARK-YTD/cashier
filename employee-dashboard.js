import { supabase } from "./supabase.js";

const session = JSON.parse(sessionStorage.getItem("employee_session"));
if (!session) window.location.href = "employee-login.html";

document.getElementById("employeeName").textContent =
  `${session.name} (ID: ${session.code})`;

/* ===============================
   عرض/إخفاء فلترة مخصصة
================================ */
document.getElementById("timeFilter").addEventListener("change", (e) => {
  const box = document.getElementById("customDateBox");
  box.style.display = e.target.value === "custom" ? "block" : "none";
});

/* ===============================
   الدالة الرئيسية
================================ */
window.loadStats = async function () {

  const { data: products } = await supabase
  
    .from("products")
    .select("id, name, category")
    .eq("partner_id", session.id);

  // ✅ عدد الأصناف المرتبطة بالموظف (بغض النظر عن المبيعات)
document.getElementById("linkedProductsCount").textContent =
  products ? products.length : 0;

// عرض أسماء الأصناف المرتبطة
const linkedList = document.getElementById("linkedProductsList");
if (linkedList) {
  linkedList.innerHTML = "";
  products?.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p.name;
    linkedList.appendChild(li);
  });
}

  if (!products || products.length === 0) return;

  const productIds = products.map(p => p.id);

  const { data: items } = await supabase
    .from("order_items")
    .select(`
      product_id,
      qty,
      price,
      order:orders!inner(id, status, created_at)
    `)
    .in("product_id", productIds)
    .eq("order.status", "completed");

  if (!items) return;

  /* ===============================
     فلترة التاريخ
  ================================ */
  const filter = document.getElementById("timeFilter").value;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  let fromDate = null;
  let toDate = null;

  if (filter === "custom") {
    fromDate = document.getElementById("dateFrom").value;
    toDate = document.getElementById("dateTo").value;
  }

  const filteredItems = items.filter(item => {

    const orderDate = item.order.created_at.slice(0, 10);
    const orderMonth = orderDate.slice(0, 7);

    if (filter === "today" && orderDate !== today) return false;
    if (filter === "month" && orderMonth !== month) return false;

    if (filter === "custom") {
      if (fromDate && orderDate < fromDate) return false;
      if (toDate && orderDate > toDate) return false;
    }

    return true;
  });

  /* ===============================
     الحسابات
  ================================ */

  let totalSales = 0;
  const uniqueOrders = new Set();
  const categoryStats = { food:0, drinks:0, sides:0 };
  const productStats = {};

  filteredItems.forEach(item => {

    totalSales += item.qty * item.price;
    uniqueOrders.add(item.order.id);

    const product = products.find(p => p.id === item.product_id);
    if (!product) return;

    // حسب القسم
    if (categoryStats[product.category] !== undefined) {
      categoryStats[product.category] += item.qty;
    }

    // حسب الصنف
    if (!productStats[product.id]) {
      productStats[product.id] = {
        name: product.name,
        qty: 0,
        value: 0
      };
    }

    productStats[product.id].qty += item.qty;
    productStats[product.id].value += item.qty * item.price;
  });

  /* ===============================
     تحديث الإحصائيات العامة
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
     ترتيب حسب الأكثر مبيعاً
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

/* تشغيل أولي */
window.loadStats();

/* تسجيل خروج */
window.logoutEmployee = function () {
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};