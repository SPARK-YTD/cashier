import { supabase } from "./supabase.js";

/* ===============================
   عناصر الصفحة
================================ */
const empName = document.getElementById("empName");
const empCode = document.getElementById("empCode");
const empPin  = document.getElementById("empPin");
const isManager = document.getElementById("isManager");

const couponEmpCode = document.getElementById("couponEmpCode");
const couponAmount  = document.getElementById("couponAmount");

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
    if (e.is_manager) div.classList.add("manager");

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
  const manager = isManager.checked;

  if (!name || !code) {
    alert("❌ الاسم ورقم الموظف مطلوبين");
    return;
  }

  if (manager && !pin) {
    alert("❌ أدخل رقم سري للمدير");
    return;
  }

  // منع التكرار
  const { data: exists } = await supabase
    .from("employees")
    .select("id")
    .eq("employee_code", code)
    .maybeSingle();

  if (exists) {
    alert("❌ رقم الموظف موجود مسبقًا");
    return;
  }

  const { error } = await supabase
    .from("employees")
    .insert({
      name,
      employee_code: code,
      manager_pin: manager ? pin : null,
      is_manager: manager
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
   إنشاء / تحديث كوبون شهري
================================ */
window.setCoupon = async function () {
  const code = couponEmpCode.value.trim();
  const amount = Number(couponAmount.value);

  if (!code || !amount) {
    alert("❌ أدخل رقم الموظف والمبلغ");
    return;
  }

  const month = new Date().toISOString().slice(0, 7);

  // حذف القديم
  await supabase
    .from("employee_coupons")
    .delete()
    .eq("employee_code", code)
    .eq("month", month);

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