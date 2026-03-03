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

  const cycle = window.currentCycle;
  const today = new Date();

  // حساب البيانات
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

  const reportHTML = `
<div style="
  font-family:Cairo, Arial;
  direction:rtl;
  margin:0;
  padding:0;
  box-sizing:border-box;
  background:white;
  display:flex;
  flex-direction:column;
">

  <!-- HEADER -->
  <div style="
    background:linear-gradient(135deg,#0f172a,#1e293b);
    color:white;
    padding:20px 25px;
    display:flex;
    justify-content:space-between;
    align-items:center;
  ">
    <div>
      <div style="font-size:20px;font-weight:700;">
        تقرير مالي للموظف
      </div>
      <div style="font-size:12px;opacity:.8;margin-top:4px;">
        ${today.toLocaleDateString('en-GB')}
      </div>
    </div>

    <img src="${window.location.origin}/cashier/assets/logo.png"
         width="60"
         style="background:white;padding:6px;border-radius:10px;">
  </div>

  <!-- CONTENT -->
  <div style="
    <div style="
  flex:1;
  padding:25px;
  display:flex;
  flex-direction:column;
">

    <div>

      <!-- Employee Info -->
      <div style="
        background:#f1f5f9;
        border-radius:12px;
        padding:14px 18px;
        margin-bottom:20px;
        font-size:13px;
        line-height:1.8;
      ">
        <strong>اسم الموظف:</strong> ${session.name}<br>
        <strong>كود الموظف:</strong> ${session.code}<br>
        <strong>رقم الدورة:</strong> ${cycle.id.substring(0,8)}
      </div>

      <!-- Financial Summary -->
      <div style="
        border-radius:12px;
        padding:18px;
        background:white;
        border:1px solid #e5e7eb;
        margin-bottom:20px;
      ">
        <div style="font-weight:700;margin-bottom:12px;">
          الملخص المالي
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span>إجمالي العمولة</span>
          <strong>${totalCommission.toFixed(3)} BHD</strong>
        </div>

        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
          <span>المدفوع</span>
          <strong>${totalPaid.toFixed(3)} BHD</strong>
        </div>

        <div style="
          display:flex;
          justify-content:space-between;
          font-weight:700;
          margin-top:10px;
          padding-top:10px;
          border-top:1px solid #e5e7eb;
          color:${remaining>0 ? '#dc2626' : '#16a34a'};
        ">
          <span>المتبقي</span>
          <span>${remaining.toFixed(3)} BHD</span>
        </div>
      </div>

      <!-- Payments -->
      <div style="
        background:#f8fafc;
        padding:14px;
        border-radius:12px;
        font-size:13px;
      ">
        <div style="font-weight:700;margin-bottom:10px;">
          سجل الدفعات
        </div>

        ${
          payouts && payouts.length
          ? payouts.map(p=>`
            <div style="
              display:flex;
              justify-content:space-between;
              padding:5px 0;
              border-bottom:1px solid #e2e8f0;
            ">
              <span>${new Date(p.paid_at).toLocaleDateString('en-GB')}</span>
              <strong>${Number(p.amount).toFixed(3)} BHD</strong>
            </div>
          `).join("")
          : "<div style='opacity:.7;'>No Payments Recorded</div>"
        }
      </div>

    </div>

    <!-- SIGNATURE -->
    <div style="
      text-align:right;
      font-size:12px;
    ">
      <div style="
        border-top:1px dashed #9ca3af;
        width:200px;
        margin-bottom:6px;
      "></div>
      Authorized Signature<br>
      خذ لك بريك
    </div>

  </div>

</div>
`;

  const element = document.createElement("div");
  element.innerHTML = reportHTML;

  html2pdf()
.set({
  margin: 0,
  filename: `Financial_Report_${session.code}.pdf`,
  html2canvas: { 
    scale: 2,
    useCORS: true,
    letterRendering: true
  },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  pagebreak: { mode: ['avoid-all'] }
})
.from(element)
.save();

});

  
/* ===============================
   Logout
================================ */
window.logoutEmployee = function () {
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};