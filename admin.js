import { supabase } from "./supabase.js";

/* ===============================
   تحميل الموظفين
================================ */
async function loadEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    alert("❌ خطأ تحميل الموظفين");
    console.error(error);
    return;
  }

  const box = document.getElementById("employeesList");
  box.innerHTML = "";

  data.forEach(emp => {
    const div = document.createElement("div");
    div.style.border = "1px solid #ddd";
    div.style.padding = "8px";
    div.style.marginBottom = "6px";

    div.innerHTML = `
      <strong>${emp.name}</strong><br>
      رقم الموظف: ${emp.employee_code}<br>
      ${emp.is_manager ? "👑 مدير" : "👤 موظف"}
    `;

    box.appendChild(div);
  });
}

/* ===============================
   إضافة موظف
================================ */
window.addEmployee = async function () {
  const name = document.getElementById("empName").value;
  const code = document.getElementById("empCode").value;
  const pin  = document.getElementById("empPin").value || null;
  const isManager = document.getElementById("isManager").checked;

  if (!name || !code) {
    alert("❌ الاسم ورقم الموظف مطلوبين");
    return;
  }

  const { error } = await supabase.from("employees").insert({
    name,
    employee_code: code,
    manager_pin: isManager ? pin : null,
    is_manager: isManager
  });

  if (error) {
    alert("❌ فشل إضافة الموظف");
    console.error(error);
    return;
  }

  alert("✅ تم إضافة الموظف");
  loadEmployees();
};

/* ===============================
   خروج
================================ */
window.logout = async function () {
  sessionStorage.removeItem("admin_auth");
  location.href = "index.html";
};

document.addEventListener("DOMContentLoaded", loadEmployees);