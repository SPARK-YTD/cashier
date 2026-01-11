import { supabase } from "./supabase.js";
import { applyLang } from "./i18n.js";

/*********************************
 * Get-Break | Daily Close Report
 *********************************/

let currentBusinessDay = null;
let previewOrders = [];

/* ========= LOAD CURRENT OPEN DAY ========= */
async function loadCurrentDay() {
  const { data } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .order("opened_at", { ascending: false })
    .limit(1)
    .single();

  currentBusinessDay = data || null;
}

/* ========= INIT ========= */
document.addEventListener("DOMContentLoaded", async () => {
  applyLang();

  const closeTimeEl   = document.getElementById("closeTime");
  const ordersCountEl = document.getElementById("ordersCount");
  const totalSalesEl  = document.getElementById("totalSales");
  const itemsReportEl = document.getElementById("itemsReport");
  const topItemEl     = document.getElementById("topItem");

  await loadCurrentDay();

  if (!currentBusinessDay) {
    closeTimeEl.textContent = "—";
    ordersCountEl.textContent = "0";
    totalSalesEl.textContent  = "0.000 د.ب";
    topItemEl.textContent     = "—";
    itemsReportEl.innerHTML =
      "<tr><td colspan='3'>لا يوجد يوم مفتوح</td></tr>";
    return;
  }

  /* ===== PREVIEW (معاينة فقط) ===== */
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      total,
      order_items (
        qty,
        price,
        products ( name )
      )
    `)
    .eq("status", "completed")
    .eq("business_day_id", currentBusinessDay.id);

  previewOrders = orders || [];

  if (!previewOrders.length) {
    closeTimeEl.textContent = "🕒 معاينة – لا توجد طلبات";
    ordersCountEl.textContent = "0";
    totalSalesEl.textContent  = "0.000 د.ب";
    topItemEl.textContent     = "—";
    itemsReportEl.innerHTML =
      "<tr><td colspan='3'>لا توجد طلبات مكتملة</td></tr>";
    return;
  }

  let totalSales = 0;
  const itemsMap = {};

  previewOrders.forEach(o => {
    totalSales += o.total;

    o.order_items.forEach(i => {
      const name = i.products.name;
      itemsMap[name] ??= { qty: 0, total: 0 };
      itemsMap[name].qty += i.qty;
      itemsMap[name].total += i.qty * i.price;
    });
  });

  const topItem =
    Object.entries(itemsMap).sort((a,b)=>b[1].qty-a[1].qty)[0]?.[0] || "—";

  closeTimeEl.textContent =
    "🕒 تقرير معاينة – اليوم ما زال مفتوح";

  ordersCountEl.textContent = previewOrders.length;
  totalSalesEl.textContent  = totalSales.toFixed(3) + " د.ب";
  topItemEl.textContent     = topItem;

  itemsReportEl.innerHTML = "";
  Object.entries(itemsMap).forEach(([name, data]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${data.qty}</td>
      <td>${data.total.toFixed(3)} د.ب</td>
    `;
    itemsReportEl.appendChild(tr);
  });
});

/* ===============================
   🔙 رجوع للكاشير (نفس اليوم)
================================ */
window.backToCashierSameDay = function () {
  window.location.href = "index.html";
};

/* ===============================
   🟢 بدء يوم جديد (الحفظ الحقيقي)
================================ */
window.startNewDayFromReport = async function () {
  if (!currentBusinessDay) {
    alert("❌ لا يوجد يوم مفتوح");
    return;
  }

  const pass = prompt("🔒 أدخل كلمة المرور لبدء يوم جديد:");
  if (pass !== "1234") {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  if (!previewOrders.length) {
    alert("⚠️ لا توجد طلبات لحفظ التقرير");
    return;
  }

  let totalSales = 0;
  const itemsMap = {};

  previewOrders.forEach(o => {
    totalSales += o.total;
    o.order_items.forEach(i => {
      const name = i.products.name;
      itemsMap[name] ??= { qty: 0, total: 0 };
      itemsMap[name].qty += i.qty;
      itemsMap[name].total += i.qty * i.price;
    });
  });

  const topItem =
    Object.entries(itemsMap).sort((a,b)=>b[1].qty-a[1].qty)[0]?.[0] || "—";

  /* ✅ حفظ التقرير */
  await supabase.from("daily_reports").insert({
    business_day_id: currentBusinessDay.id,
    report_date: currentBusinessDay.day_date,
    orders_count: previewOrders.length,
    total_sales: totalSales,
    top_item: topItem,
    items: itemsMap
  });

  /* 🔒 إقفال اليوم */
  await supabase.from("business_days")
    .update({
      is_open: false,
      closed_at: new Date().toISOString()
    })
    .eq("id", currentBusinessDay.id);

  /* 🟢 فتح يوم جديد */
  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0,10),
    is_open: true,
    opened_at: new Date().toISOString()
  });

  alert("✅ تم حفظ التقرير وبدء يوم جديد");
  window.location.href = "index.html";
};

/* ===============================
   🖨 تحميل PDF
================================ */
window.downloadPDF = () => window.print();