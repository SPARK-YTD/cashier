import { supabase } from "./supabase.js";

const monthPicker = document.getElementById("monthPicker");
const searchInput = document.getElementById("searchInput");
const reportBody = document.getElementById("reportBody");

// الشهر الحالي تلقائيًا
const now = new Date();
monthPicker.value = now.toISOString().slice(0, 7);

// تحميل أولي
loadReport();

// أحداث
monthPicker.addEventListener("change", loadReport);
searchInput.addEventListener("input", loadReport);

async function loadReport() {
  reportBody.innerHTML = `<tr><td colspan="6">⏳ جاري التحميل...</td></tr>`;

  const month = monthPicker.value;
  const search = searchInput.value.trim();

  let query = supabase
    .from("employee_coupons")
    .select("*")
    .eq("month", month)
    .order("employee_code");

  if (search) {
    query = query.eq("employee_code", search);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    reportBody.innerHTML = `<tr><td colspan="6">لا توجد بيانات</td></tr>`;
    return;
  }

  reportBody.innerHTML = "";

  data.forEach(c => {
    const used = c.total_amount - c.remaining_amount;
    const percent = c.total_amount
      ? Math.round((used / c.total_amount) * 100)
      : 0;

    let status = "status-none";
    let statusText = "لم يُستخدم";

    if (percent >= 100) {
      status = "status-full";
      statusText = "مستخدم بالكامل";
    } else if (percent > 0) {
      status = "status-ok";
      statusText = "مستخدم جزئيًا";
    }

    reportBody.innerHTML += `
      <tr>
        <td>${c.employee_code}</td>
        <td>${c.total_amount.toFixed(3)} د.ب</td>
        <td>${used.toFixed(3)} د.ب</td>
        <td>${c.remaining_amount.toFixed(3)} د.ب</td>
        <td>${percent}%</td>
        <td class="${status}">${statusText}</td>
      </tr>
    `;
  });
}

// رجوع
window.goBack = function () {
  location.href = "admin.html";
};