import { supabase } from "./supabase.js";

/* ===============================
   تحميل البيانات
================================ */
async function loadCoupons() {
  const { data, error } = await supabase
    .from("employee_coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    alert("❌ خطأ في جلب البيانات");
    console.error(error);
    return;
  }

  const tbody = document.getElementById("couponsTable");
  tbody.innerHTML = "";

  data.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.employee_code}</td>
      <td>${c.month}</td>
      <td>${Number(c.total_amount).toFixed(3)}</td>
      <td>${Number(c.remaining_amount).toFixed(3)}</td>
      <td>
        <button class="danger" onclick="resetCoupon('${c.id}')">
          تصفير
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ===============================
   حفظ كوبون
================================ */
window.saveCoupon = async function () {
  const employeeCode = document.getElementById("employeeCode").value.trim();
  const month = document.getElementById("month").value.trim();
  const amount = parseFloat(document.getElementById("amount").value);

  if (!employeeCode || !month || !amount) {
    alert("❌ جميع الحقول مطلوبة");
    return;
  }

  // هل موجود؟
  const { data: existing } = await supabase
    .from("employee_coupons")
    .select("id")
    .eq("employee_code", employeeCode)
    .eq("month", month)
    .maybeSingle();

  if (existing) {
    // تحديث
    await supabase
      .from("employee_coupons")
      .update({
        total_amount: amount,
        remaining_amount: amount
      })
      .eq("id", existing.id);
  } else {
    // إضافة
    await supabase.from("employee_coupons").insert({
      employee_code: employeeCode,
      month,
      total_amount: amount,
      remaining_amount: amount
    });
  }

  alert("✅ تم الحفظ");
  loadCoupons();
};

/* ===============================
   تصفير الرصيد
================================ */
window.resetCoupon = async function (id) {
  if (!confirm("تأكيد تصفير الرصيد؟")) return;

  await supabase
    .from("employee_coupons")
    .update({ remaining_amount: 0 })
    .eq("id", id);

  loadCoupons();
};

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", loadCoupons);