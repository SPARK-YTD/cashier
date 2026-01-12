import { supabase } from "./supabase.js";
import { applyLang } from "./i18n.js";

/*********************************
 * Get-Break | Daily Close Report
 *********************************/

document.addEventListener("DOMContentLoaded", async () => {
  applyLang();

  const closeTimeEl   = document.getElementById("closeTime");
  const ordersCountEl = document.getElementById("ordersCount");
  const totalSalesEl  = document.getElementById("totalSales");
  const itemsReportEl = document.getElementById("itemsReport");
  const topItemEl     = document.getElementById("topItem");

  /* ===============================
     جلب آخر تقرير محفوظ (آخر يوم مقفل)
  ================================ */
  const { data: report, error } = await supabase
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

  if (error || !report) {
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
  Object.entries(report.items || {}).forEach(([name, item]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${item.qty}</td>
      <td>${item.total.toFixed(3)} د.ب</td>
    `;
    itemsReportEl.appendChild(tr);
  });
});

/* ===============================
   🔙 رجوع للكاشير
   (يكمل نفس اليوم إذا كان مفتوح)
================================ */
window.backToCashierSameDay = function () {
  window.location.href = "index.html";
};

/* ===============================
   🟢 بدء يوم جديد
   ✔ لا يعيد حفظ التقرير
   ✔ يفتح يوم جديد فقط
================================ */
window.startNewDayFromReport = async function () {
  const pass = prompt("🔒 أدخل كلمة المرور:");
  if (pass !== "1234") {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  // تأكد ما فيه يوم مفتوح
  const { data: openDay } = await supabase
    .from("business_days")
    .select("id")
    .eq("is_open", true)
    .single();

  if (openDay) {
    alert("⚠️ يوجد يوم مفتوح بالفعل");
    return;
  }

  // فتح يوم جديد
  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0, 10),
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