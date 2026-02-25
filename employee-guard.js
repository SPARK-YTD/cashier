const session = sessionStorage.getItem("employee_session");

if (!session) {
  window.location.href = "employee-login.html";
} else {
  try {
    const employee = JSON.parse(session);

    // حماية إضافية لو البيانات خربت
    if (!employee.id || !employee.code) {
      sessionStorage.removeItem("employee_session");
      window.location.href = "employee-login.html";
    }

  } catch {
    sessionStorage.removeItem("employee_session");
    window.location.href = "employee-login.html";
  }
}