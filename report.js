import { supabase } from "./supabase.js";
import { applyLang, setLang, t } from "./i18n.js";

window.setLang = setLang;

/*********************************
 * Get-Break | Daily Close Report (Supabase)
 *********************************/

document.addEventListener("DOMContentLoaded", async () => {
  applyLang();

  const closeTimeEl   = document.getElementById("closeTime");
  const ordersCountEl = document.getElementById("ordersCount");
  const totalSalesEl  = document.getElementById("totalSales");
  const itemsReportEl = document.getElementById("itemsReport");
  const topItemEl     = document.getElementById("topItem");

  /* ===== جلب التقرير ===== */
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get("id");

  let query = supabase.from("daily_reports").select("*");

  if (reportId) {
    query = query.eq("id", reportId).limit(1);
  } else {
    query = query.order("created_at", { ascending: false }).limit(1);
  }

  const { data: reports, error } = await query;

  if (error || !reports || reports.length === 0) {
    ordersCountEl.textContent = "0";
    totalSalesEl.textContent  = "0.000 د.ب";
    topItemEl.textContent     = "—";
    itemsReportEl.innerHTML =
      "<tr><td colspan='3'>لا يوجد تقرير محفوظ</td></tr>";
    return;
  }

  const report = reports[0];

  /* ===== وقت الإقفال ===== */
  closeTimeEl.textContent =
    "🕒 وقت الإقفال: " +
    new Date(report.created_at).toLocaleString("ar-BH");

  /* ===== الملخص ===== */
  ordersCountEl.textContent = report.orders_count;
  totalSalesEl.textContent =
    Number(report.total_sales).toFixed(3) + " د.ب";
  topItemEl.textContent = report.top_item || "—";

  /* ===== جدول الأصناف ===== */
  itemsReportEl.innerHTML = "";

  const items = report.items || {};

  if (Object.keys(items).length === 0) {
    itemsReportEl.innerHTML =
      "<tr><td colspan='3'>لا توجد أصناف</td></tr>";
    return;
  }

  Object.keys(items).forEach(name => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${items[name].qty}</td>
      <td>${items[name].total.toFixed(3)} د.ب</td>
    `;
    itemsReportEl.appendChild(tr);
  });

  /* ===== طباعة تلقائية ===== */
  if (params.get("print") === "1") {
    setTimeout(() => window.print(), 500);
  }
});

/* ===== بدء يوم جديد ===== */
window.newDay = async function () {
  const pass = prompt("🔒 أدخل كلمة المرور لبدء يوم جديد:");

  if (pass !== "1234") {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  if (!confirm("هل أنت متأكد من بدء يوم جديد؟")) return;

  const { error } = await supabase
    .from("orders")
    .update({ status: "closed" })
    .eq("status", "completed");

  if (error) {
    alert("❌ حصل خطأ أثناء بدء يوم جديد");
    console.error(error);
    return;
  }

  alert("✅ تم بدء يوم جديد بنجاح");
  window.location.href = "index.html";
};

/* ===== NAV ===== */
window.goBack = function () {
  window.location.href = "index.html";
};

window.downloadPDF = function () {
  window.print();
};
