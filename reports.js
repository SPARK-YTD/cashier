import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  applyLang();
  await loadReports();
});

/* ===============================
   تحميل أرشيف التقارير
================================ */
async function loadReports() {
  const tbody = document.getElementById("reportsList");
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="4">⏳ جاري تحميل التقارير...</td>
    </tr>
  `;

  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select(`
      id,
      report_date,
      orders_count,
      total_sales
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("LOAD REPORTS ERROR:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="4">❌ خطأ في تحميل التقارير</td>
      </tr>
    `;
    return;
  }

  if (!reports || reports.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">📭 لا توجد تقارير محفوظة</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = "";

  reports.forEach(report => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${report.report_date}</td>
      <td>${report.orders_count}</td>
      <td>${Number(report.total_sales).toFixed(3)} د.ب</td>
      <td>
        <button onclick="viewReport('${report.id}')">عرض</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* ===============================
   عرض تقرير
================================ */
window.viewReport = function (id) {
  window.location.href = `report.html?id=${id}`;
};

/* ===============================
   رجوع
================================ */
window.goBack = () => history.back();