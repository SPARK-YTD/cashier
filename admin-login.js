import { supabase } from "./supabase.js";

window.loginAdmin = async function () {

  const code = document.getElementById("adminCode").value.trim();
  const pin = document.getElementById("adminPin").value.trim();
  const errorMsg = document.getElementById("errorMsg");

  errorMsg.textContent = "";

  if (!code || !pin) {
    errorMsg.textContent = "أدخل جميع البيانات";
    return;
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("employee_code", code)
    .single();

  if (!employee) {
    errorMsg.textContent = "المستخدم غير موجود";
    return;
  }

  if (!employee.active) {
    errorMsg.textContent = "الحساب موقوف";
    return;
  }

  if (employee.role !== "manager") {
    errorMsg.textContent = "ليس لديك صلاحية دخول الإدارة";
    return;
  }

  if (employee.pin_hash !== pin) {
    errorMsg.textContent = "كلمة المرور غير صحيحة";
    return;
  }

  // إنشاء جلسة مدير
  sessionStorage.setItem("admin_session", JSON.stringify({
    id: employee.id,
    name: employee.name
  }));

  window.location.href = "admin-employees.html";
};