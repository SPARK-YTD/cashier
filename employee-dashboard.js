import { supabase } from "./supabase.js";

window.employeeLogin = async function () {

  const code = document.getElementById("loginCode").value.trim();
  const password = document.getElementById("loginPin").value.trim();
  const msg = document.getElementById("loginMsg");

  if (!code || !password) {
    msg.innerText = "أدخل رقم الموظف والرقم السري";
    return;
  }

  const { data: employee, error } = await supabase
    .from("employees")
    .select("*")
    .eq("employee_code", code)
    .eq("password", password)
    .single();

  if (error || !employee) {
    msg.innerText = "بيانات الدخول غير صحيحة";
    return;
  }

  // نحفظ بياناته في localStorage
  localStorage.setItem("employee", JSON.stringify(employee));

  // ننتقل للوحة الموظف
  window.location.href = "employee-panel.html";
};