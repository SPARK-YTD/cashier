import { supabase } from "./supabase.js";

let employee = null;

async function checkEmployeeAccess() {

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    window.location.replace("employee-login.html");
    return;
  }

  const { data, error: empError } = await supabase
    .from("employees")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  if (empError || !data) {
    window.location.replace("employee-login.html");
    return;
  }

  employee = data;

  document.getElementById("empName").innerText = "👤 " + employee.name;

  loadMySales();
}

document.addEventListener("DOMContentLoaded", async () => {
  await checkEmployeeAccess();
});

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

window.logout = async function () {
  await supabase.auth.signOut();
  window.location.replace("employee-login.html");
};