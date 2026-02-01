import { supabase } from "./supabase.js";

/* ===============================
   تحميل الموظفين
================================ */
async function loadEmployees() {
  const { data } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  const box = document.getElementById("employeesList");
  box.innerHTML = "";

  (data || []).forEach(e => {
    const div = document.createElement("div");
    div.style.padding = "8px";
    div.style.borderBottom = "1px dashed #ccc";

    div.innerHTML = `
      <strong>${e.name}</strong>
      <div>رقم: ${e.employee_code}</div>
      <div>${e.is_manager ? "🛡️ مدير" : "👤 موظف"}</div>
    `;

    box.appendChild(div);
  });
}

/* ===============================
   إضافة موظف
================================ */
window.addEmployee = async function () {
  const name = empName.value.trim();
  const code = empCode.value.trim();
  const pin  = empPin.value.trim();
  const isManager = isManager.checked;

  if (!name || !code) {
    alert("❌ الاسم ورقم الموظف مطلوبين");
    return;
  }

  const { error } = await supabase
    .from("employees")
    .insert({
      name,
      employee_code: code,
      manager_pin: isManager ? pin : null,
      is_manager: isManager
    });

  if (error) {
    alert("❌ فشل إضافة الموظف");
    console.error(error);
    return;
  }

  alert("✅ تم إضافة الموظف");
  empName.value = empCode.value = empPin.value = "";
  isManager.checked = false;

  loadEmployees();
};

/* ===============================
   إنشاء / تحديث كوبون
================================ */
window.setCoupon = async function () {
  const code = couponEmpCode.value.trim();
  const amount = Number(couponAmount.value);

  if (!code || !amount) {
    alert("❌ أدخل رقم الموظف والمبلغ");
    return;
  }

  const month = new Date().toISOString().slice(0, 7);

  // حذف القديم (إن وجد)
  await supabase
    .from("employee_coupons")
    .delete()
    .eq("employee_code", code)
    .eq("month", month);

  // إنشاء جديد
  const { error } = await supabase
    .from("employee_coupons")
    .insert({
      employee_code: code,
      month,
      total_amount: amount,
      remaining_amount: amount
    });

  if (error) {
    alert("❌ فشل حفظ الكوبون");
    console.error(error);
    return;
  }

  alert("✅ تم حفظ الكوبون");
  couponEmpCode.value = couponAmount.value = "";
};

/* ===============================
   أدوات
================================ */
window.backToCashier = () => {
  location.href = "index.html";
};

document.addEventListener("DOMContentLoaded", loadEmployees);