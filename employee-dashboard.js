import { supabase } from "./supabase.js";

window.employeeLogin = async function () {

  const code = document.getElementById("loginCode").value.trim();
  const password = document.getElementById("loginPin").value.trim();
  const msg = document.getElementById("loginMsg");

  if (!code || !password) {
    msg.innerText = "أدخل رقم الموظف والرقم السري";
    return;
  }

  const email = code + "@staff.local";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg.innerText = "بيانات الدخول غير صحيحة";
    return;
  }

  // جلب بيانات الموظف من الجدول
  const { data: emp } = await supabase
    .from("employees")
    .select("id, name")
    .eq("auth_user_id", data.user.id)
    .single();

  if (!emp) {
    msg.innerText = "لم يتم العثور على بيانات الموظف";
    return;
  }

  // تحويل للوحة الموظف
  window.location.href = "employee-panel.html";
};