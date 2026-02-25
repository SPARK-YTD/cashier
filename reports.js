import { supabase } from "./supabase.js";

const PASSWORD = "1234";

document.addEventListener("DOMContentLoaded", () => {
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
      orders_count,
      total_sales,
      created_at
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("LOAD REPORTS ERROR:", error);
    tbody.innerHTML =
      "<tr><td colspan='4'>❌ خطأ في تحميل التقارير</td></tr>";
    return;
  }

  if (!reports || reports.length === 0) {
    tbody.innerHTML =
      "<tr><td colspan='4'>📭 لا توجد تقارير محفوظة</td></tr>";
    return;
  }

  reports.forEach(report => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${report.report_date}</td>
      <td>${report.orders_count}</td>
      <td>${Number(report.total_sales).toFixed(3)} د.ب</td>
      <td>
        <button onclick="viewReport('${report.id}')">📄 عرض</button>
        <button onclick="printReport('${report.id}')">🖨 PDF</button>
        <button class="danger" onclick="deleteReport('${report.id}')">🗑 حذف</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* ===============================
   عرض تقرير محفوظ
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
   حذف تقرير نهائيًا
================================ */
window.deleteReport = async function (id) {
  if (!confirm("⚠️ هل أنت متأكد من حذف التقرير نهائيًا؟")) return;

  const pass = prompt("🔒 أدخل كلمة المرور:");
  if (pass !== PASSWORD) {
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

  alert("✅ تم حذف التقرير نهائيًا");
  loadReports(); // تحديث الجدول
};

/* ===============================
   رجوع
================================ */
window.goBack = () => history.back();