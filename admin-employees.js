import { supabase } from "./supabase.js";

const table = document.getElementById("employeesTable");
const modal = document.getElementById("employeeModal");

const currentMonth = new Date().toISOString().slice(0, 7);
let employeesCache = [];

/* ===================================================
   🔹 Dashboard
=================================================== */
async function loadDashboard() {

  const { data: employees } = await supabase
    .from("employees")
    .select("id");

  const { data: coupons } = await supabase
    .from("employee_coupons")
    .select("total_amount, remaining_amount")
    .eq("month", currentMonth);

  const { data: logs } = await supabase
    .from("employee_coupon_logs")
    .select("amount")
    .eq("month", currentMonth);

  document.getElementById("totalEmployees").textContent =
    employees?.length || 0;

  document.getElementById("totalCoupons").textContent =
    coupons?.reduce((s, c) => s + Number(c.total_amount), 0).toFixed(3) || "0.000";

  document.getElementById("totalUsage").textContent =
    logs?.reduce((s, l) => s + Number(l.amount), 0).toFixed(3) || "0.000";
}

/* ===================================================
   🔹 Auto Renew ذكي
=================================================== */
async function ensureCoupon(employeeCode) {

  const { data: existing } = await supabase
    .from("employee_coupons")
    .select("*")
    .eq("employee_code", employeeCode)
    .eq("month", currentMonth)
    .maybeSingle();

  if (existing) return existing;

  const { data: last } = await supabase
    .from("employee_coupons")
    .select("*")
    .eq("employee_code", employeeCode)
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!last) return null;

  const { data: newCoupon } = await supabase
    .from("employee_coupons")
    .insert({
      employee_code: employeeCode,
      month: currentMonth,
      total_amount: last.total_amount,
      remaining_amount: last.total_amount,
      active: true
    })
    .select()
    .single();

  return newCoupon;
}

/* ===================================================
   🔹 تحميل الموظفين
=================================================== */
async function loadEmployees() {

  const { data } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  employeesCache = data || [];
  table.innerHTML = "";

  for (const emp of employeesCache) {

    const coupon = await ensureCoupon(emp.employee_code);

    const row = document.createElement("tr");

    if (coupon && !coupon.active) {
      row.style.background = "#fff1f2";
    }

    let remainingColor = "#374151";

    if (coupon && coupon.remaining_amount <= coupon.total_amount * 0.2) {
      remainingColor = "#dc2626";
    }

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
              <div style="color:${remainingColor};font-size:13px">
                متبقي: ${coupon.remaining_amount.toFixed(3)}
              </div>
              <div style="font-size:12px;color:${coupon.active ? '#16a34a':'#dc2626'}">
                ${coupon.active ? "مفعل":"موقوف"}
              </div>
            `
            : "لا يوجد"
        }
      </td>

      <td>
        <button class="primary"
          onclick="openEmployeeProfile('${emp.id}')">
          👤 ملف
        </button>

        <button class="secondary"
          onclick="openCouponManager('${emp.employee_code}')">
          🎟 كوبون
        </button>
      </td>
    `;

    table.appendChild(row);
  }

  loadDashboard();
}

/* ===================================================
   🔹 إضافة موظف
=================================================== */
window.saveEmployee = async function () {

  const name = empName.value;
  const code = empCode.value;
  const pin = empPin.value;
  const role = empRole.value;

  if (!name || !code || !pin)
    return alert("أدخل جميع البيانات");

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

window.openModal = () => modal.style.display = "flex";
window.closeModal = () => modal.style.display = "none";

/* ===================================================
   🔹 إدارة ملف الموظف
=================================================== */
window.openEmployeeProfile = async function (id) {

  const { data: emp } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box" style="max-width:450px">
      <h3>👤 إدارة ملف الموظف</h3>

      <input id="editName" value="${emp.name}">
      <input id="editCode" value="${emp.employee_code}">
      <input id="editPin" placeholder="كلمة مرور جديدة (اختياري)">

      <select id="editRole">
        <option value="employee" ${emp.role==="employee"?"selected":""}>موظف</option>
        <option value="manager" ${emp.role==="manager"?"selected":""}>مدير</option>
      </select>

      <button class="variant-btn" id="saveBtn">💾 حفظ</button>
      <button class="variant-btn" id="toggleBtn">
        ${emp.active?"⛔ إيقاف":"✅ تفعيل"}
      </button>
      <button class="variant-btn danger" id="deleteBtn">🗑 حذف</button>
      <button class="variant-cancel">إغلاق</button>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  overlay.querySelector("#saveBtn").onclick = async () => {

    const updates = {
      name: editName.value,
      employee_code: editCode.value,
      role: editRole.value
    };

    if (editPin.value) updates.pin_hash = editPin.value;

    await supabase.from("employees")
      .update(updates)
      .eq("id", id);

    alert("تم التحديث");
    overlay.remove();
    loadEmployees();
  };

  overlay.querySelector("#toggleBtn").onclick = async () => {
    await supabase.from("employees")
      .update({ active: !emp.active })
      .eq("id", id);

    alert("تم تحديث الحالة");
    overlay.remove();
    loadEmployees();
  };

  overlay.querySelector("#deleteBtn").onclick = async () => {

    if (!confirm("حذف الموظف نهائياً؟")) return;

    await supabase.from("employees")
      .delete()
      .eq("id", id);

    overlay.remove();
    loadEmployees();
  };
};

/* ===================================================
   🔹 إدارة الكوبون
=================================================== */
window.openCouponManager = async function (employeeCode) {

  const coupon = await ensureCoupon(employeeCode);

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box" style="max-width:450px">
      <h3>🎟 إدارة الكوبون</h3>

      <div>الشهر: ${currentMonth}</div>

      <input type="number" id="couponAmount"
        value="${coupon?.total_amount || ""}"
        placeholder="المبلغ">

      <div style="margin:8px 0">
        المتبقي:
        <strong>
          ${coupon ? coupon.remaining_amount.toFixed(3) : "—"}
        </strong>
      </div>

      <button class="variant-btn" id="saveCouponBtn">
        💾 حفظ
      </button>

      ${
        coupon
        ? `<button class="variant-btn" id="resetBtn">
            🔄 تصفير
          </button>`
        : ""
      }

      ${
        coupon
        ? `<button class="variant-btn" id="toggleCouponBtn">
            ${coupon.active ? "⛔ إيقاف":"✅ تفعيل"}
          </button>`
        : ""
      }

      <button class="variant-cancel">إغلاق</button>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  overlay.querySelector("#saveCouponBtn").onclick = async () => {

    const amount = Number(couponAmount.value);
    if (!amount || amount <= 0)
      return alert("مبلغ غير صالح");

    if (coupon) {
      await supabase.from("employee_coupons")
        .update({
          total_amount: amount,
          remaining_amount: amount
        })
        .eq("id", coupon.id);
    } else {
      await supabase.from("employee_coupons")
        .insert({
          employee_code: employeeCode,
          month: currentMonth,
          total_amount: amount,
          remaining_amount: amount,
          active: true
        });
    }

    alert("تم الحفظ");
    overlay.remove();
    loadEmployees();
  };

  if (coupon) {

    overlay.querySelector("#resetBtn").onclick = async () => {

      await supabase.from("employee_coupons")
        .update({ remaining_amount: coupon.total_amount })
        .eq("id", coupon.id);

      alert("تم التصفير");
      overlay.remove();
      loadEmployees();
    };

    overlay.querySelector("#toggleCouponBtn").onclick = async () => {

      await supabase.from("employee_coupons")
        .update({ active: !coupon.active })
        .eq("id", coupon.id);

      alert("تم التحديث");
      overlay.remove();
      loadEmployees();
    };
  }
};

loadEmployees();