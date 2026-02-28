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

async function getOrCreateOpenCycle(employeeId) {

  const { data: existingCycle } = await supabase
    .from("employee_cycles")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("status", "open")
    .maybeSingle();

  if (existingCycle) {
    return existingCycle;
  }

  const { data: newCycle, error } = await supabase
    .from("employee_cycles")
    .insert({
      employee_id: employeeId,
      calculation_mode: "supplied_only",
      status: "open"
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating cycle:", error);
    return null;
  }

  return newCycle;
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

  const requestId = ++currentRequest;

  /* ===============================
     تأكد من وجود دورة
  ================================ */

  const cycle = await getOrCreateOpenCycle(session.id);
  if (!cycle) {
    alert("خطأ في إنشاء الدورة");
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

const remaining = totalCommission - totalPaid;

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