import { supabase } from "./supabase.js";

/* ===============================
   Session Check
================================ */
const session = JSON.parse(sessionStorage.getItem("employee_session"));
if (!session) window.location.href = "employee-login.html";

document.getElementById("employeeName").textContent =
  `${session.name} (ID: ${session.code})`;

  /* ===============================
   Cycle Logic
================================ */

async function getOpenCycle(employeeId) {

  const { data: existingCycle } = await supabase
    .from("employee_cycles")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("status", "open")
    .maybeSingle();

  return existingCycle || null;
}

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
  console.log("Session:", session);
  console.log("Session ID:", session.id);

  const requestId = ++currentRequest;

  /* ===============================
     تأكد من وجود دورة
  ================================ */

  const cycle = await getOpenCycle(session.id);
  console.log("Open Cycle Result:", cycle);
  if (!cycle) {
  const financeBox = document.getElementById("financeBox");
  if (financeBox) {
    financeBox.innerHTML = `
      <div class="card">
        <strong>لا توجد دورة مفتوحة حالياً</strong>
      </div>
    `;
  }
  return;
}
  
  // ممكن تستخدمها لاحقاً لحساب المستحق
  window.currentCycle = cycle;
  
  /* ===============================
   الحساب المالي للدورة
================================ */

// 1️⃣ حساب العمولة من employee_sales
const { data: sales } = await supabase
  .from("employee_sales")
  .select("payout_amount")
  .eq("cycle_id", cycle.id);

let totalCommission = 0;

if (sales) {
  totalCommission = sales.reduce(
    (s,i)=> s + Number(i.payout_amount || 0),
    0
  );
}

// 2️⃣ حساب المدفوع
const { data: payouts } = await supabase
  .from("employee_payouts")
  .select("amount, paid_at")
  .eq("cycle_id", cycle.id)
  .order("paid_at", { ascending: false });

let totalPaid = 0;

if (payouts) {
  totalPaid = payouts.reduce(
    (s,p)=> s + Number(p.amount || 0),
    0
  );
}

const remaining = Math.max(0, totalCommission - totalPaid);

// 3️⃣ عرض النتائج
const financeBox = document.getElementById("financeBox");

if (financeBox) {
  financeBox.innerHTML = `
    <div style="
      background:white;
      padding:20px;
      border-radius:12px;
      box-shadow:0 6px 20px rgba(0,0,0,0.05);
    ">
      <h3 style="margin-top:0">💼 حساب الدورة الحالية</h3>

      <div style="margin-bottom:10px">
        🧮 إجمالي العمولة: <strong>${totalCommission.toFixed(3)} د.ب</strong><br>
        💵 المدفوع: <strong>${totalPaid.toFixed(3)} د.ب</strong><br>
        ⚖️ المتبقي: 
        <strong style="color:${remaining > 0 ? '#dc2626' : '#16a34a'}">
          ${remaining.toFixed(3)} د.ب
        </strong>
      </div>

      <div style="margin-top:15px">
        <strong>📜 سجل الدفعات:</strong>
        ${
          payouts && payouts.length
            ? payouts.map(p => `
                <div style="font-size:13px;margin-top:6px">
                  ${Number(p.amount).toFixed(3)} د.ب
                  - ${new Date(p.paid_at).toLocaleDateString()}
                </div>
              `).join("")
            : `<div style="font-size:13px;color:#64748b;margin-top:6px">
                لا توجد دفعات بعد
              </div>`
        }
      </div>
    </div>
  `;
}

  /* ===============================
     جلب أصناف الموظف
  ================================ */

 const { data: linked, error: productsError } = await supabase
  .from("product_employees")
  .select(`
    product_id,
    products (
      id,
      name,
      category
    )
  `)
  .eq("employee_id", session.id);

if (productsError) {
  console.error(productsError);
  return;
}

const products = linked
  ? linked.map(l => l.products).filter(Boolean)
  : [];

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
     الأداء العام (كما هو)
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

  if (filter === "today") {

    const { data: businessDay } = await supabase
      .from("business_days")
      .select("id")
      .eq("is_open", true)
      .single();

    if (!businessDay) return;

    query = query.eq("order.business_day_id", businessDay.id);
  }

  if (filter === "month") {

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    query = query
      .gte("order.created_at", start.toISOString())
      .lte("order.created_at", end.toISOString());
  }

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

  /* ===============================
     الحسابات (الأداء فقط)
  ================================ */

  let totalSales = 0;
  const uniqueOrders = new Set();
  const productStats = {};

  items?.forEach(item => {

    const value = item.qty * item.price;
    totalSales += value;
    uniqueOrders.add(item.order.id);

    if (!productStats[item.product_id]) {
      productStats[item.product_id] = {
        qty: 0,
        value: 0
      };
    }

    productStats[item.product_id].qty += item.qty;
    productStats[item.product_id].value += value;
  });

  document.getElementById("ordersCount").textContent =
    uniqueOrders.size;

  document.getElementById("totalSales").textContent =
    totalSales.toFixed(3) + " د.ب";

  /* ===============================
   عرض المبيعات حسب الصنف (مرتب)
================================ */

const productSalesList = document.getElementById("productSalesList");
productSalesList.innerHTML = "";

// ترتيب من الأعلى مبيعاً للأقل
const sortedProducts = Object.entries(productStats)
  .sort((a,b)=> b[1].value - a[1].value);

if (sortedProducts.length > 0) {

  const maxValue = sortedProducts[0][1].value;

  sortedProducts.forEach(([productId, stats]) => {

    const product = products.find(p => p.id === productId);
    if (!product) return;

    const li = document.createElement("li");

    li.innerHTML = `
      <span>${product.name}</span>
      <span>
        ${stats.qty} قطعة —
        ${stats.value.toFixed(3)} د.ب
      </span>
    `;

    // تمييز أعلى صنف
    if (stats.value === maxValue) {
      li.classList.add("highlight");
    }

    productSalesList.appendChild(li);
  });

}
  
};
  
/* ===============================
   Auto Load
================================ */
window.loadStats();

/* ===============================
   PDF REPORT
================================ */

document.addEventListener("click", async function(e){

  if (e.target.id !== "downloadReportBtn") return;

  if (!window.currentCycle){
    alert("لا توجد دورة مفتوحة");
    return;
  }

  const { jsPDF } = window.jspdf;
const doc = new jsPDF();

// تحميل الشعار
const img = new Image();
img.src = "assets/logo.png"; // ← هذا هو المسار الصحيح عندك

await new Promise(resolve => {
  img.onload = resolve;
});

// إضافة الشعار في الأعلى (منتصف الصفحة)
doc.addImage(img, "PNG", 75, 10, 60, 25);
  const cycle = window.currentCycle;

  // جلب بيانات العمولة
  const { data: sales } = await supabase
    .from("employee_sales")
    .select("payout_amount")
    .eq("cycle_id", cycle.id);

  let totalCommission = 0;
  if (sales){
    totalCommission = sales.reduce(
      (s,i)=> s + Number(i.payout_amount || 0),
      0
    );
  }

  // جلب المدفوع
  const { data: payouts } = await supabase
    .from("employee_payouts")
    .select("amount, paid_at")
    .eq("cycle_id", cycle.id)
    .order("paid_at", { ascending: false });

  let totalPaid = 0;
  if (payouts){
    totalPaid = payouts.reduce(
      (s,p)=> s + Number(p.amount || 0),
      0
    );
  }

  const remaining = Math.max(0, totalCommission - totalPaid);

  // محتوى التقرير
  doc.setFontSize(16);
  doc.text("Employee Financial Report", 20, 45);

  doc.setFontSize(16);
doc.text("Employee Financial Report", 20, 50);

doc.setFontSize(12);
doc.text(`Employee: ${session.name}`, 20, 60);
doc.text(`Employee Code: ${session.code}`, 20, 67);

doc.text(`Total Commission: ${totalCommission.toFixed(3)} BHD`, 20, 80);
doc.text(`Total Paid: ${totalPaid.toFixed(3)} BHD`, 20, 87);
doc.text(`Remaining: ${remaining.toFixed(3)} BHD`, 20, 94);

doc.text("Payment History:", 20, 110);

  let y = 120;

  if (payouts && payouts.length){
    payouts.forEach(p => {
      doc.text(
        `${Number(p.amount).toFixed(3)} BHD - ${new Date(p.paid_at).toLocaleDateString()}`,
        20,
        y
      );
      y += 8;
    });
  } else {
    doc.text("No payments yet", 20, y);
  }

  doc.save(`report_${session.name}.pdf`);

});

/* ===============================
   Logout
================================ */
window.logoutEmployee = function () {
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};