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

  // التحقق يتم بالسيرفر (bcrypt + قفل بعد المحاولات الخاطئة)
  const { data: res, error } = await supabase.rpc("employee_login", {
    p_code: code,
    p_pin: pin
  });

  if (error || !res) {
    errorMsg.textContent = "حصل خطأ، حاول مرة ثانية";
    return;
  }

  if (!res.ok) {
    if (res.error === "LOCKED") {
      errorMsg.textContent =
        `محاولات خاطئة كثيرة. حاول بعد ${Math.ceil((res.retry_after || 60) / 60)} دقيقة`;
    } else if (res.error === "INACTIVE") {
      errorMsg.textContent = "الحساب موقوف";
    } else {
      // رسالة موحدة: ما نكشف إذا الرقم الوظيفي موجود أو لا
      errorMsg.textContent = "الرقم الوظيفي أو كلمة المرور غير صحيحة";
    }
    return;
  }

  // جلسة الموظف (التوكن يتحقق منه السيرفر بكل طلب)
  sessionStorage.setItem("employee_session", JSON.stringify({
    id: res.employee.id,
    name: res.employee.name,
    code: res.employee.code,
    token: res.token
  }));

  window.location.href = "employee-dashboard.html";
};
