import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  applyLang();
  loadReports();
});

/* ===============================
   تحميل أرشيف التقارير
================================ */
async function loadReports() {
  const tbody = document.getElementById("reportsList");
  if (!tbody) return;

  tbody.innerHTML = "";

  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select(`
      id,
      report_date,
      created_at,
      orders_count,
      total_sales
    `)
    .order("created_at", { ascending: false });

  if (error || !reports || reports.length === 0) {
    tbody.innerHTML =
      "<tr><td colspan='5'>لا توجد تقارير محفوظة</td></tr>";
    return;
  }

  reports.forEach(report => {
    const tr = document.createElement("tr");

    const dateTime = new Date(report.created_at).toLocaleString("ar-BH");

    tr.innerHTML = `
      <td>${report.report_date}</td>
      <td>${dateTime}</td>
      <td>${report.orders_count}</td>
      <td>${Number(report.total_sales).toFixed(3)} د.ب</td>
      <td>
        <button onclick="viewReport('${report.id}')">عرض</button>
        <button onclick="printReport('${report.id}')">🖨 PDF</button>
        <button class="danger" onclick="deleteReport('${report.id}')">🗑</button>
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
   طباعة PDF
================================ */
window.printReport = function (id) {
  window.open(`report.html?id=${id}&print=1`, "_blank");
};

/* ===============================
   حذف تقرير
================================ */
window.deleteReport = async function (id) {
  if (!confirm("⚠️ هل أنت متأكد من حذف التقرير؟")) return;

  const pass = prompt("🔒 أدخل كلمة المرور:");
  if (pass !== "1234") {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  const { error } = await supabase
    .from("daily_reports")
    .delete()
    .eq("id", id);

  if (error) {
    alert("❌ فشل حذف التقرير");
    console.error(error);
    return;
  }

  alert("✅ تم حذف التقرير");
  loadReports();
};

/* ===============================
   رجوع
================================ */
window.goBack = () => history.back(); 