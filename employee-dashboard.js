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

if (!cycle) {

  const financeBox = document.getElementById("financeBox");
  if (financeBox) {
    financeBox.innerHTML = `
      <div class="card">
        <strong>لا توجد دورة مفتوحة حالياً</strong>
      </div>
    `;
  }

  window.currentCycle = null;

} else {

  window.currentCycle = cycle;

  /* ===============================
     الحساب المالي للدورة
  ================================ */

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

  const financeBox = document.getElementById("financeBox");

  if (financeBox) {
    financeBox.innerHTML = `
      <div>
        <h3>💼 حساب الدورة الحالية</h3>
        إجمالي العمولة: ${totalCommission.toFixed(3)} د.ب <br>
        المدفوع: ${totalPaid.toFixed(3)} د.ب <br>
        المتبقي: ${remaining.toFixed(3)} د.ب
      </div>
    `;
  }

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
  ? [...new Map(linked
      .map(l => l.products)
      .filter(Boolean)
      .map(p => [p.id, p])
    ).values()]
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
    alert("لا توجد دورة");
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const cycle = window.currentCycle;
  const today = new Date();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  /* =========================
     جلب البيانات
  ========================= */

  const { data: sales } = await supabase
    .from("employee_sales")
    .select("payout_amount")
    .eq("cycle_id", cycle.id);

  const totalCommission = sales?.reduce(
    (s,i)=> s + Number(i.payout_amount || 0),0
  ) || 0;

  const { data: payouts } = await supabase
    .from("employee_payouts")
    .select("amount, paid_at")
    .eq("cycle_id", cycle.id)
    .order("paid_at",{ascending:false});

  const totalPaid = payouts?.reduce(
    (s,p)=> s + Number(p.amount || 0),0
  ) || 0;

  const remaining = Math.max(0,totalCommission-totalPaid);

  /* =========================
     HEADER
  ========================= */

  const logo = new Image();
logo.src = "assets/logo.png";
await new Promise(r => logo.onload = r);

const pageWidth = doc.internal.pageSize.width;

// خلفية داكنة
doc.setFillColor(20, 20, 20);
doc.rect(0, 0, pageWidth, 55, "F");

// خط فاصل ذهبي خفيف تحت الهيدر
doc.setFillColor(212, 175, 55);
doc.rect(0, 55, pageWidth, 2, "F");

// حساب التوسيط بدقة
const logoWidth = 45;
const logoHeight = 22;
const logoX = (pageWidth - logoWidth) / 2;

doc.addImage(logo, "PNG", logoX, 10, logoWidth, logoHeight);

// عنوان التقرير
doc.setTextColor(255,255,255);
doc.setFontSize(18);
doc.text(
  "EMPLOYEE FINANCIAL REPORT",
  pageWidth/2,
  45,
  { align: "center" }
);

doc.setTextColor(0,0,0);

  /* =========================
     معلومات الموظف
  ========================= */

  doc.setFillColor(245,245,245);
  doc.roundedRect(15,55,pageWidth-30,30,3,3,"F");

  doc.setFontSize(12);
  doc.text("Employee: " + session.name, 20, 70);
  doc.text("Employee Code: " + session.code, 20, 78);

  doc.text("Cycle ID: " + cycle.id.substring(0,8), pageWidth-80, 70);
  doc.text("Status: " + cycle.status.toUpperCase(), pageWidth-80, 78);

  doc.setFontSize(10);
  doc.text("Report Date: " + today.toLocaleDateString(), 20, 90);

  /* =========================
     Financial Summary Box
  ========================= */

  doc.setFillColor(255,255,255);
  doc.roundedRect(15,100,pageWidth-30,45,3,3,"F");

  doc.setDrawColor(230);
  doc.roundedRect(15,100,pageWidth-30,45,3,3);

  doc.setFontSize(14);
  doc.text("Financial Summary", 20, 115);

  doc.setFontSize(12);

  doc.text("Total Commission", 25, 130);
  doc.text(totalCommission.toFixed(3) + " BHD", pageWidth-40, 130, { align:"right" });

  doc.text("Total Paid", 25, 140);
  doc.text(totalPaid.toFixed(3) + " BHD", pageWidth-40, 140, { align:"right" });

  doc.setFont(undefined,"bold");
  doc.text("Remaining", 25, 150);
  doc.text(remaining.toFixed(3) + " BHD", pageWidth-40, 150, { align:"right" });
  doc.setFont(undefined,"normal");

  if (remaining === 0){
    doc.setTextColor(22,163,74);
    doc.setFontSize(16);
    doc.text("PAID IN FULL", pageWidth/2, 165, { align:"center" });
    doc.setTextColor(0,0,0);
  }

  /* =========================
     Payment Table
  ========================= */

  doc.setFontSize(14);
  doc.text("Payment History", 15, 185);

  let y = 195;

  if (payouts && payouts.length){

    doc.setFillColor(240,240,240);
    doc.rect(15,y-5,pageWidth-30,10,"F");

    doc.setFontSize(11);
    doc.text("Date", 20, y);
    doc.text("Amount (BHD)", pageWidth-40, y, { align:"right" });

    y += 10;

    payouts.forEach(p=>{
      doc.text(
        new Date(p.paid_at).toLocaleDateString(),
        20,
        y
      );

      doc.text(
        Number(p.amount).toFixed(3),
        pageWidth-40,
        y,
        { align:"right" }
      );

      y += 8;
    });

  } else {
    doc.setFontSize(12);
    doc.text("No payments recorded", 20, y);
  }

  /* =========================
     Signature Section
  ========================= */

  doc.setDrawColor(180);
  doc.line(pageWidth-80, pageHeight-50, pageWidth-20, pageHeight-50);

  doc.setFontSize(10);
  doc.text("Authorized Signature", pageWidth-80, pageHeight-55);

  doc.setFontSize(14);
  doc.text("Khath Lak Break", pageWidth-80, pageHeight-40);

  /* =========================
     Footer
  ========================= */

  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "Confidential Document - System Generated Report",
    pageWidth/2,
    pageHeight-10,
    { align: "center" }
  );

  doc.save(`Financial_Report_${session.code}.pdf`);
});

/* ===============================
   Logout
================================ */
window.logoutEmployee = function () {
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};