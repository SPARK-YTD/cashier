import { supabase } from "./supabase.js";

const table = document.getElementById("employeesTable");
const modal = document.getElementById("employeeModal");

window.openModal = () => modal.style.display = "flex";
window.closeModal = () => modal.style.display = "none";

/* ========================================
   تحميل الموظفين + كوبون الشهر الحالي
======================================== */
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
      .eq("employee_code", emp.employee_code)
      .eq("month", month)
      .maybeSingle();

    const row = document.createElement("tr");

    // 🎨 تلوين إذا الكوبون موقوف
    if (coupon && !coupon.active) {
      row.style.background = "#fff1f2";
    }

    // 🎨 تنبيه إذا الرصيد أقل من 20%
    let remainingColor = "#374151";
    if (coupon && coupon.remaining_amount <= coupon.total_amount * 0.2) {
      remainingColor = "#dc2626";
    }

    row.innerHTML = `
      <td>${emp.name}</td>
      <td>${emp.employee_code}</td>
      <td>${emp.role}</td>
      <td>${emp.active ? "نشط" : "موقوف"}</td>

      <td>
        ${
          coupon
            ? `
              <div style="font-weight:700">
                ${coupon.total_amount.toFixed(3)} د.ب
              </div>
              <div style="font-size:13px;color:${remainingColor}">
                متبقي: ${coupon.remaining_amount.toFixed(3)}
              </div>
              <div style="
                font-size:13px;
                font-weight:700;
                color:${coupon.active ? '#10b981' : '#ef4444'}
              ">
                ${coupon.active ? "مفعل" : "موقوف"}
              </div>
            `
            : `<span style="color:#9ca3af">لا يوجد</span>`
        }
      </td>

      <td>
        <button class="danger" onclick="deleteEmployee('${emp.id}')">
          حذف
        </button>

        <button class="primary" onclick="toggleEmployee('${emp.id}', ${emp.active})">
          ${emp.active ? "إيقاف" : "تفعيل"}
        </button>

        <button class="success" onclick="openCouponManager('${emp.employee_code}')">
          🎟 إدارة
        </button>
      </td>
    `;

    table.appendChild(row);
  }
}

/* ========================================
   إضافة موظف
======================================== */
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

/* ========================================
   حذف / تفعيل موظف
======================================== */
window.deleteEmployee = async function(id) {
  if (!confirm("حذف الموظف؟")) return;
  await supabase.from("employees").delete().eq("id", id);
  loadEmployees();
};

window.toggleEmployee = async function(id, state) {
  await supabase
    .from("employees")
    .update({ active: !state })
    .eq("id", id);
  loadEmployees();
};

/* ========================================
   إدارة كوبون الموظف
======================================== */
window.openCouponManager = async function(employeeCode) {

  const month = new Date().toISOString().slice(0,7);

  const { data: employee } = await supabase
    .from("employees")
    .select("name")
    .eq("employee_code", employeeCode)
    .single();

  const { data: coupon } = await supabase
    .from("employee_coupons")
    .select("*")
    .eq("employee_code", employeeCode)
    .eq("month", month)
    .maybeSingle();

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box" style="max-width:420px;text-align:center">

      <h3>🎟 إدارة كوبون الموظف</h3>

      <div style="margin-bottom:10px;font-weight:700">
        ${employee?.name || ""} (ID: ${employeeCode})
      </div>

      <div style="margin-bottom:10px">
        الشهر: ${month}
      </div>

      <div style="margin-bottom:10px">
        المبلغ:
        <input type="number" id="couponAmount"
          value="${coupon?.total_amount || ""}"
          style="width:100%;padding:8px;margin-top:5px">
      </div>

      <div style="margin-bottom:10px">
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
          ? `<button class="variant-btn" id="resetCouponBtn">
              🔄 تصفير
            </button>`
          : ""
      }

      ${
        coupon
          ? `<button class="variant-btn" id="toggleCouponBtn">
              ${coupon.active ? "⛔ إيقاف" : "✅ تفعيل"}
            </button>`
          : ""
      }

      <button class="variant-cancel">إغلاق</button>

    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  // 💾 حفظ / إنشاء
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
          employee_code: employeeCode,
          month,
          total_amount: amount,
          remaining_amount: amount,
          active: true
        });
    }

    alert("✅ تم الحفظ");
    overlay.remove();
    loadEmployees();
  };

  // 🔄 تصفير
  if (coupon) {
    overlay.querySelector("#resetCouponBtn").onclick = async () => {
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

    overlay.querySelector("#toggleCouponBtn").onclick = async () => {
      await supabase
        .from("employee_coupons")
        .update({
          active: !coupon.active
        })
        .eq("id", coupon.id);

      alert("✅ تم تحديث الحالة");
      overlay.remove();
      loadEmployees();
    };
  }
};

loadEmployees();