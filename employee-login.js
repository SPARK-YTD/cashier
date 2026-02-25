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

  // 1️⃣ تسجيل الدخول عبر Supabase Auth
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    msg.innerText = "بيانات الدخول غير صحيحة";
    return;
  }

  // 2️⃣ جلب بيانات الموظف من جدول employees
  const { data: employee, error: empError } = await supabase
    .from("employees")
    .select("id, name, is_manager")
    .eq("auth_user_id", data.user.id)
    .single();

  if (empError || !employee) {
    await supabase.auth.signOut();
    msg.innerText = "لم يتم العثور على بيانات الموظف";
    return;
  }

  // 3️⃣ الانتقال للوحة الموظف
  window.location.href = "employee-panel.html";
};