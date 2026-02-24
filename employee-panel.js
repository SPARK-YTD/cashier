import { supabase } from "./supabase.js";

// 🔐 التحقق من تسجيل الدخول
const employee = JSON.parse(localStorage.getItem("employee"));

if (!employee) {
  window.location.replace("employee-login.html");
}

// عرض الاسم
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("empName").innerText = "👤 " + employee.name;
  loadMySales();
});

// تحميل مبيعات الموظف
async function loadMySales() {

  const box = document.getElementById("mySalesResult");

  const { data, error } = await supabase
    .from("order_items")
    .select(`
      qty,
      price,
      products!inner (
        partner_id
      )
    `)
    .eq("products.partner_id", employee.id);

  if (error) {
    box.innerHTML = "❌ خطأ في تحميل البيانات";
    return;
  }

  let totalQty = 0;
  let totalSales = 0;

  (data || []).forEach(row => {
    totalQty += row.qty;
    totalSales += row.qty * row.price;
  });

  box.innerHTML = `
    🧾 عدد القطع: ${totalQty} <br><br>
    💰 إجمالي المبيعات: ${totalSales.toFixed(3)} د.ب
  `;
}

// تسجيل خروج
window.logout = function () {
  localStorage.removeItem("employee");
  window.location.replace("employee-login.html");
};