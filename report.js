import { supabase } from "./supabase.js";
import { applyLang } from "./i18n.js";

/*********************************
 * Get-Break | Daily Close Report
 *********************************/

let currentBusinessDay = null;

document.addEventListener("DOMContentLoaded", async () => {
  applyLang();

  const closeTimeEl   = document.getElementById("closeTime");
  const ordersCountEl = document.getElementById("ordersCount");
  const totalSalesEl  = document.getElementById("totalSales");
  const itemsReportEl = document.getElementById("itemsReport");
  const topItemEl     = document.getElementById("topItem");

  /* ===============================
     جلب آخر يوم مغلق
  ================================ */
  const { data: report } = await supabase
    .from("daily_reports")
    .select(`
      id,
      report_date,
      created_at,
      orders_count,
      total_sales,
      top_item,
      items,
      business_day_id
    `)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!report) {
    closeTimeEl.textContent = "—";
    ordersCountEl.textContent = "0";
    totalSalesEl.textContent  = "0.000 د.ب";
    topItemEl.textContent     = "—";
    itemsReportEl.innerHTML =
      "<tr><td colspan='3'>لا يوجد تقرير محفوظ</td></tr>";
    return;
  }

  /* ===============================
     عرض بيانات التقرير
  ================================ */
  closeTimeEl.textContent =
    "🕒 وقت الإقفال: " +
    new Date(report.created_at).toLocaleString("ar-BH");

  ordersCountEl.textContent = report.orders_count;
  totalSalesEl.textContent  =
    Number(report.total_sales).toFixed(3) + " د.ب";

  topItemEl.textContent = report.top_item || "—";

  itemsReportEl.innerHTML = "";
  Object.keys(report.items || {}).forEach(name => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${report.items[name].qty}</td>
      <td>${report.items[name].total.toFixed(3)} د.ب</td>
    `;
    itemsReportEl.appendChild(tr);
  });

  /* ===============================
     جلب حالة اليوم الحالي
  ================================ */
  const { data: openDay } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .single();

  currentBusinessDay = openDay || null;
});

/* ===============================
   🔙 رجوع للكاشير (نفس اليوم)
   لا يقفل اليوم ولا يحفظ تقرير
================================ */
window.goBack = function () {
  window.location.href = "index.html";
};

/* ===============================
   🟢 بدء يوم جديد (من التقرير فقط)
   ✔ يقفل اليوم السابق
   ✔ يحفظ التقرير
   ✔ يفتح يوم جديد
================================ */
window.startNewDayFromReport = async function () {
  const pass = prompt("🔒 أدخل كلمة المرور لبدء يوم جديد:");
  if (pass !== "1234") {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  if (!confirm("هل أنت متأكد من بدء يوم جديد؟")) return;

  /* لا يسمح إذا فيه يوم مفتوح */
  const { data: openDay } = await supabase
    .from("business_days")
    .select("id")
    .eq("is_open", true)
    .single();

  if (openDay) {
    alert("⚠️ يجب إقفال اليوم الحالي أولًا من الكاشير");
    return;
  }

  /* إنشاء يوم جديد */
  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0,10),
    is_open: true,
    opened_at: new Date().toISOString()
  });

  alert("✅ تم بدء يوم جديد");
  window.location.href = "index.html";
};

/* ===============================
   🖨 تحميل PDF
================================ */
window.downloadPDF = () => window.print();