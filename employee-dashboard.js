import { supabase } from "./supabase.js";

/* ===============================
   تسجيل دخول الموظف
================================ */

window.employeeLogin = async function () {

  const code = document.getElementById("loginCode").value.trim();
  const pin  = document.getElementById("loginPin").value.trim();
  const msg  = document.getElementById("loginMsg");

  if (!code || !pin) {
    msg.innerText = "أدخل رقم الموظف والرقم السري";
    return;
  }

  const { data, error } = await supabase
    .from("employees")
    .select("id, name, manager_pin")
    .eq("employee_code", code)
    .single();

  if (error || !data) {
    msg.innerText = "الموظف غير موجود";
    return;
  }

  if (data.manager_pin !== pin) {
    msg.innerText = "الرقم السري غير صحيح";
    return;
  }

  // حفظ الجلسة
  localStorage.setItem("employee_id", data.id);
  localStorage.setItem("employee_name", data.name);

  // تحويل لصفحة الداشبورد
  window.location.href = "employee-panel.html";
};