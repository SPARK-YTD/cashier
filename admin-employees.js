import { supabase } from "./supabase.js";

const table = document.getElementById("employeesTable");
const modal = document.getElementById("employeeModal");

let employeesCache = [];
const currentMonth = new Date().toISOString().slice(0,7);

/* ===================================================
   🟢 Dashboard
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
    coupons?.reduce((s,c)=>s+Number(c.total_amount),0).toFixed(3) || "0.000";

  document.getElementById("totalUsage").textContent =
    logs?.reduce((s,l)=>s+Number(l.amount),0).toFixed(3) || "0.000";
}

/* ===================================================
   🟢 Auto Renew ذكي
=================================================== */
async function ensureCouponExists(employeeCode){

  const { data: existing } = await supabase
    .from("employee_coupons")
    .select("*")
    .eq("employee_code", employeeCode)
    .eq("month", currentMonth)
    .maybeSingle();

  if(existing) return existing;

  const { data: lastCoupon } = await supabase
    .from("employee_coupons")
    .select("*")
    .eq("employee_code", employeeCode)
    .order("month",{ascending:false})
    .limit(1)
    .maybeSingle();

  if(!lastCoupon) return null;

  const { data: newCoupon } = await supabase
    .from("employee_coupons")
    .insert({
      employee_code: employeeCode,
      month: currentMonth,
      total_amount: lastCoupon.total_amount,
      remaining_amount: lastCoupon.total_amount,
      active: true
    })
    .select()
    .single();

  return newCoupon;
}

/* ===================================================
   🟢 تحميل الموظفين
=================================================== */
async function loadEmployees(){

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .order("created_at",{ascending:false});

  employeesCache = employees || [];
  table.innerHTML = "";

  for(const emp of employeesCache){

    const coupon = await ensureCouponExists(emp.employee_code);

    const row = document.createElement("tr");

    // 🎨 تلوين الكوبون الموقوف
    if(coupon && !coupon.active){
      row.style.background = "#fff1f2";
    }

    let remainingColor = "#374151";

    if(coupon && coupon.remaining_amount <= coupon.total_amount * 0.2){
      remainingColor = "#dc2626";
    }

    row.innerHTML = `
      <td>${emp.name}</td>
      <td>${emp.employee_code}</td>
      <td>${emp.role}</td>
      <td>
        <span class="badge ${emp.active ? "active":"inactive"}">
          ${emp.active ? "نشط":"موقوف"}
        </span>
      </td>

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
              ${coupon.active ? "مفعل":"موقوف"}
            </div>
          `
          : `<span style="color:#9ca3af">لا يوجد</span>`
        }
      </td>

      <td>
        <button class="secondary"
          onclick="openCouponManager('${emp.employee_code}')">
          🎟 إدارة
        </button>
      </td>
    `;

    table.appendChild(row);
  }

  loadDashboard();
}

/* ===================================================
   🟢 إضافة موظف
=================================================== */
window.saveEmployee = async function(){

  const name = empName.value;
  const code = empCode.value;
  const pin = empPin.value;
  const role = empRole.value;

  if(!name || !code || !pin)
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

window.openModal = ()=> modal.style.display="flex";
window.closeModal = ()=> modal.style.display="none";

/* ===================================================
   🟢 إدارة كوبون
=================================================== */
window.openCouponManager = async function(employeeCode){

  const coupon = await ensureCouponExists(employeeCode);

  const { data: logs } = await supabase
    .from("employee_coupon_logs")
    .select("amount, created_at")
    .eq("employee_code", employeeCode)
    .eq("month", currentMonth)
    .order("created_at",{ascending:false});

  const overlay = document.createElement("div");
  overlay.className="variant-overlay";

  overlay.innerHTML = `
  <div class="variant-box" style="max-width:500px">

    <h3>🎟 إدارة كوبون</h3>

    <div>الشهر: ${currentMonth}</div>

    <input type="number" id="couponAmount"
      value="${coupon?.total_amount || ""}"
      placeholder="المبلغ الجديد">

    <div style="margin-bottom:10px">
      المتبقي:
      <strong>
        ${coupon ? coupon.remaining_amount.toFixed(3) : "—"}
      </strong>
    </div>

    <button class="variant-btn" id="saveBtn">💾 تحديث</button>

    ${
      coupon
      ? `<button class="variant-btn" id="resetBtn">
          🔄 تصفير الرصيد
        </button>`
      : ""
    }

    ${
      coupon
      ? `<button class="variant-btn" id="toggleBtn">
          ${coupon.active ? "⛔ إيقاف":"✅ تفعيل"}
        </button>`
      : ""
    }

    <hr>

    <h4>📜 سجل الاستخدام</h4>
    <div style="max-height:150px;overflow:auto;font-size:13px">
      ${
        logs?.length
        ? logs.map(l=>`
            <div>
              - ${Number(l.amount).toFixed(3)} د.ب
              (${new Date(l.created_at).toLocaleDateString()})
            </div>
          `).join("")
        : "لا يوجد عمليات"
      }
    </div>

    <button class="variant-cancel">إغلاق</button>
  </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector(".variant-cancel").onclick=()=>overlay.remove();

  overlay.querySelector("#saveBtn").onclick=async()=>{
    const amount = Number(couponAmount.value);
    if(!amount || amount<=0)
      return alert("مبلغ غير صالح");

    if(coupon){
      await supabase.from("employee_coupons")
        .update({
          total_amount: amount,
          remaining_amount: amount
        })
        .eq("id",coupon.id);
    }

    alert("تم التحديث");
    overlay.remove();
    loadEmployees();
  };

  if(coupon){
    overlay.querySelector("#resetBtn").onclick=async()=>{
      await supabase.from("employee_coupons")
        .update({ remaining_amount: coupon.total_amount })
        .eq("id",coupon.id);

      alert("تم التصفير");
      overlay.remove();
      loadEmployees();
    };

    overlay.querySelector("#toggleBtn").onclick=async()=>{
      await supabase.from("employee_coupons")
        .update({ active: !coupon.active })
        .eq("id",coupon.id);

      alert("تم التحديث");
      overlay.remove();
      loadEmployees();
    };
  }
};

/* =================================================== */
loadEmployees();