import { supabase } from "./supabase.js";

window.loginEmployee = async function () {

  const code = document.getElementById("employeeCode").value.trim();
  const pin = document.getElementById("employeePin").value.trim();
  const errorMsg = document.getElementById("errorMsg");

  errorMsg.textContent = "";

  if (!code || !pin) {
    errorMsg.textContent = "أدخل الرقم الوظيفي وكلمة المرور";
    return;
  }

  // جلب الموظف من قاعدة البيانات
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id, name, employee_code, pin_hash, active")
    .eq("employee_code", code)
    .single();

  if (error || !employee) {
    errorMsg.textContent = "الموظف غير موجود";
    return;
  }

  if (!employee.active) {
    errorMsg.textContent = "الحساب موقوف";
    return;
  }

  // التحقق من كلمة المرور (حالياً مقارنة مباشرة)
  if (employee.pin_hash !== pin) {
    errorMsg.textContent = "كلمة المرور غير صحيحة";
    return;
  }

  // إنشاء جلسة خاصة بالموظف
  sessionStorage.setItem("employee_session", JSON.stringify({
    id: employee.id,
    name: employee.name,
    code: employee.employee_code
  }));

  // الانتقال للداشبورد
  window.location.href = "employee-dashboard.html";
};