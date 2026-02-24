window.employeeLogin = async function () {

  const code = document.getElementById("loginCode").value.trim();
  const msg = document.getElementById("loginMsg");

  if (!code) {
    msg.innerText = "أدخل رقم الموظف";
    return;
  }

  const { data, error } = await supabase
    .from("employees")
    .select("id, name")
    .eq("employee_code", code)
    .single();

  if (error || !data) {
    msg.innerText = "الموظف غير موجود";
    return;
  }

  // نحفظه في localStorage
  localStorage.setItem("employee_id", data.id);
  localStorage.setItem("employee_name", data.name);

  msg.innerText = "تم تسجيل الدخول";
  loadMySales();
};