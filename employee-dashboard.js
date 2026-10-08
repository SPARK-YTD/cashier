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
   جلب بيانات اللوحة من السيرفر (دالة آمنة - تعرض بيانات هذا الموظف فقط)
================================ */
async function fetchDashboard() {
  const filter = document.getElementById("timeFilter").value;
  let from = null, to = null;

  if (filter === "month") {
    const now = new Date();
    from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  }

  if (filter === "custom") {
    const fromDate = document.getElementById("dateFrom").value;
    const toDate = document.getElementById("dateTo").value;
    if (fromDate) from = new Date(fromDate).toISOString();
    if (toDate) {
      const endCustom = new Date(toDate);
      endCustom.setHours(23, 59, 59, 999);
      to = endCustom.toISOString();
    }
  }

  const { data, error } = await supabase.rpc("employee_dashboard", {
    p_token: session.token,
    p_filter: filter,
    p_from: from,
    p_to: to
  });

  if (error) {
    console.error(error);
    return null;
  }

  if (!data || data.ok === false) {
    sessionStorage.removeItem("employee_session");
    window.location.href = "employee-login.html";
    return null;
  }

  window.lastDash = data;
  return data;
}

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

const dash = await fetchDashboard();
if (!dash) return;
if (requestId !== currentRequest) return;
const cycle = dash.cycle;

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

  const totalCommission = Number(dash.total_commission || 0);
  const totalPaid = Number(dash.total_paid || 0);

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

const products = dash.products || [];

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

  const items = dash.items || [];

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
    uniqueOrders.add(item.order_id);

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

  // حساب البيانات (من آخر تحميل للوحة)
  const lastDash = window.lastDash || { total_commission: 0, total_paid: 0, payouts: [] };
  const totalCommission = Number(lastDash.total_commission || 0);
  const totalPaid = Number(lastDash.total_paid || 0);
  const payouts = lastDash.payouts || [];

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
window.logoutEmployee = async function () {
  try {
    await Promise.race([
      Promise.resolve(supabase.rpc("employee_logout", { p_token: session.token })),
      new Promise((r) => setTimeout(r, 1500))
    ]);
  } catch {}
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};
