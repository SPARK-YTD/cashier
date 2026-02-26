import { supabase } from "./supabase.js";

const table = document.getElementById("employeesTable");
const modal = document.getElementById("employeeModal");

window.openModal = () => modal.style.display = "flex";
window.closeModal = () => modal.style.display = "none";

async function loadEmployees() {
  const { data } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  table.innerHTML = "";

  data?.forEach(emp => {

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${emp.name}</td>
      <td>${emp.employee_code}</td>
      <td>${emp.role}</td>
      <td>${emp.active ? "نشط" : "موقوف"}</td>
      <td>
        <td>
  <button class="danger" onclick="deleteEmployee('${emp.id}')">
    حذف
  </button>

  <button class="primary" onclick="toggleEmployee('${emp.id}', ${emp.active})">
    ${emp.active ? "إيقاف" : "تفعيل"}
  </button>

  <button class="secondary" onclick="openCouponManager('${emp.employee_code}')">
    🎟 كوبون
  </button>
</td>
    `;

    table.appendChild(row);
  });
}

window.saveEmployee = async function () {

  const name = document.getElementById("empName").value;
  const code = document.getElementById("empCode").value;
  const pin = document.getElementById("empPin").value;
  const role = document.getElementById("empRole").value;

  if (!name || !code || !pin) {
    alert("أدخل جميع البيانات");
    return;
  }

  await supabase.from("employees").insert({
    name,
    employee_code: code,
    pin_hash: pin,
    role,
    active: true
  });

  closeModal();
  loadEmployees();
};

window.deleteEmployee = async function(id) {
  if (!confirm("حذف الموظف؟")) return;

  await supabase.from("employees").delete().eq("id", id);
  loadEmployees();
};

window.toggleEmployee = async function(id, state) {
  await supabase.from("employees")
    .update({ active: !state })
    .eq("id", id);

  loadEmployees();
};

loadEmployees();