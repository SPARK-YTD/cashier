import { supabase } from "./supabase.js";

// قراءة الجلسة
const session = JSON.parse(sessionStorage.getItem("employee_session"));

if (!session) {
  window.location.href = "employee-login.html";
}

// عرض اسم الموظف
document.getElementById("employeeName").textContent =
  `${session.name} (ID: ${session.code})`;

// تحميل الإحصائيات
async function loadEmployeeStats() {

  try {

    // جلب الطلبات المرتبطة بالموظف
    const { data: orders, error } = await supabase
      .from("orders")
      .select("total")
      .eq("employee_code", session.code)
      .eq("status", "completed");

    if (error) {
      console.error("STATS ERROR:", error);
      return;
    }

    const count = orders.length;
    const totalSales = orders.reduce((sum, o) => sum + Number(o.total || 0), 0);

    document.getElementById("ordersCount").textContent = count;
    document.getElementById("totalSales").textContent =
      totalSales.toFixed(3) + " د.ب";

  } catch (err) {
    console.error(err);
  }
}

loadEmployeeStats();

// تسجيل خروج
window.logoutEmployee = function () {
  sessionStorage.removeItem("employee_session");
  window.location.href = "employee-login.html";
};