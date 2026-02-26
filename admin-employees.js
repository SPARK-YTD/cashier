import { supabase } from "./supabase.js";

const table = document.getElementById("employeesTable");
const modal = document.getElementById("employeeModal");

window.openModal = () => modal.style.display = "flex";
window.closeModal = () => modal.style.display = "none";

/* ===============================
   تحميل الموظفين + كوبوناتهم
================================ */
async function loadEmployees() {

  const month = new Date().toISOString().slice(0,7);

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  table.innerHTML = "";

  for (const emp of employees || []) {

    const { data: coupon } = await supabase
      .from("employee_coupons")
      .select("*")
      .eq("employee_id", emp.id)
      .eq("month", month)
      .maybeSingle();

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${emp.name}</td>
      <td>${emp.employee_code}</td>
      <td>${emp.role}</td>
      <td>
        <span class="badge ${emp.active ? "active" : "inactive"}">
          ${emp.active ? "نشط" : "موقوف"}
        </span>
      </td>

      <td>
        ${
          coupon
            ? `
              <div><strong>${coupon.total_amount.toFixed(3)} د.ب</strong></div>
              <div style="font-size:13px">
                متبقي: ${coupon.remaining_amount.toFixed(3)}
              </div>
              <div style="font-size:12px;color:${coupon.active ? '#16a34a' : '#dc2626'}">
                ${coupon.active ? "مفعل" : "موقوف"}
              </div>
            `
            : `<span style="color:#9ca3af">لا يوجد</span>`
        }
      </td>

      <td>
        <button class="primary" onclick="openEditEmployee('${emp.id}')">
          📝 ملف
        </button>

        <button class="secondary" onclick="openCouponManager('${emp.id}')">
          🎟 كوبون
        </button>

        <button class="danger" onclick="deleteEmployee('${emp.id}')">
          حذف
        </button>
      </td>
    `;

    table.appendChild(row);
  }
}

/* ===============================
   تعديل بيانات الموظف
================================ */
window.openEditEmployee = async function(empId) {

  const { data: emp } = await supabase
    .from("employees")
    .select("*")
    .eq("id", empId)
    .single();

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box">
      <h3>📝 تعديل بيانات الموظف</h3>

      <input id="editName" value="${emp.name}" placeholder="الاسم">
      <input id="editCode" value="${emp.employee_code}" placeholder="الرقم الوظيفي">
      <input id="editPin" value="${emp.pin_hash}" placeholder="كلمة المرور">

      <select id="editRole">
        <option value="employee" ${emp.role === "employee" ? "selected" : ""}>موظف</option>
        <option value="manager" ${emp.role === "manager" ? "selected" : ""}>مدير</option>
      </select>

      <button class="variant-btn" id="saveEditBtn">💾 حفظ</button>
      <button class="variant-cancel">إغلاق</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  overlay.querySelector("#saveEditBtn").onclick = async () => {

    const name = document.getElementById("editName").value;
    const code = document.getElementById("editCode").value;
    const pin = document.getElementById("editPin").value;
    const role = document.getElementById("editRole").value;

    const { error } = await supabase
      .from("employees")
      .update({
        name,
        employee_code: code,
        pin_hash: pin,
        role
      })
      .eq("id", empId);

    if (error) {
      if (error.code === "23505") {
        alert("❌ الرقم الوظيفي مستخدم مسبقاً");
      } else {
        alert("❌ حدث خطأ أثناء التحديث");
      }
      return;
    }

    alert("✅ تم التحديث بنجاح");
    overlay.remove();
    loadEmployees();
  };
};

/* ===============================
   إدارة كوبون الموظف
================================ */
window.openCouponManager = async function(empId) {

  const month = new Date().toISOString().slice(0,7);

  const { data: emp } = await supabase
    .from("employees")
    .select("name")
    .eq("id", empId)
    .single();

  const { data: coupon } = await supabase
    .from("employee_coupons")
    .select("*")
    .eq("employee_id", empId)
    .eq("month", month)
    .maybeSingle();

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box">
      <h3>🎟 إدارة كوبون</h3>

      <div style="margin-bottom:10px;font-weight:700">
        ${emp.name}
      </div>

      <input type="number" id="couponAmount"
        value="${coupon?.total_amount || ""}"
        placeholder="المبلغ">

      <button class="variant-btn" id="saveCouponBtn">💾 حفظ</button>
      ${coupon ? `<button class="variant-btn" id="resetBtn">🔄 تصفير</button>` : ""}
      <button class="variant-cancel">إغلاق</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  overlay.querySelector("#saveCouponBtn").onclick = async () => {

    const amount = Number(document.getElementById("couponAmount").value);

    if (!amount || amount <= 0) {
      alert("❌ أدخل مبلغ صحيح");
      return;
    }

    if (coupon) {
      await supabase
        .from("employee_coupons")
        .update({
          total_amount: amount,
          remaining_amount: amount,
          active: true
        })
        .eq("id", coupon.id);
    } else {
      await supabase
        .from("employee_coupons")
        .insert({
          employee_id: empId,
          month,
          total_amount: amount,
          remaining_amount: amount,
          active: true
        });
    }

    alert("✅ تم حفظ الكوبون");
    overlay.remove();
    loadEmployees();
  };

  if (coupon) {
    overlay.querySelector("#resetBtn").onclick = async () => {
      await supabase
        .from("employee_coupons")
        .update({
          remaining_amount: coupon.total_amount
        })
        .eq("id", coupon.id);

      alert("✅ تم تصفير الرصيد");
      overlay.remove();
      loadEmployees();
    };
  }
};

/* ===============================
   حذف موظف
================================ */
window.deleteEmployee = async function(id) {
  if (!confirm("هل أنت متأكد من الحذف؟")) return;

  await supabase.from("employees").delete().eq("id", id);
  loadEmployees();
};

loadEmployees();