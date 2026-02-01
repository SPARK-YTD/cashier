import { supabase } from "./supabase.js";

/* ===============================
   عناصر الصفحة
================================ */
const empName = document.getElementById("empName");
const empCode = document.getElementById("empCode");
const empPin  = document.getElementById("empPin");
const isManager = document.getElementById("isManager");

const couponEmpCode = document.getElementById("couponEmpCode");
const couponAmount  = document.getElementById("couponAmount");

/* ===============================
   تحميل الموظفين
================================ */
async function loadEmployees() {
  const { data } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  const box = document.getElementById("employeesList");
  box.innerHTML = "";

  (data || []).forEach(e => {
    const div = document.createElement("div");
    div.style.padding = "10px";
    div.style.borderBottom = "1px dashed #ccc";

    div.innerHTML = `
      <strong>${e.name}</strong>
      <div>رقم الموظف: ${e.employee_code}</div>
      <div>${e.is_manager ? "🛡️ مدير" : "👤 موظف"}</div>

      <div style="margin-top:8px">
<button onclick="editEmployee('${e.id}', '${e.name.replace(/'/g, "\\'")}', ${e.is_manager})">
          ✏️ تعديل
        </button>

        <button
          class="danger"
          onclick="deleteEmployee('${e.id}', '${e.employee_code}', ${e.is_manager})"
          style="margin-top:6px"
        >
          🗑 حذف
        </button>
      </div>
    `;
    box.appendChild(div);
  });
}

/* ===============================
   إضافة موظف
================================ */
window.addEmployee = async function () {
  const name = empName.value.trim();
  const code = empCode.value.trim();
  const pin  = empPin.value.trim();
  const manager = isManager.checked;

  if (!name || !code) {
    alert("❌ الاسم ورقم الموظف مطلوبين");
    return;
  }

  if (manager && !pin) {
    alert("❌ أدخل رقم سري للمدير");
    return;
  }

  const { data: exists } = await supabase
    .from("employees")
    .select("id")
    .eq("employee_code", code)
    .maybeSingle();

  if (exists) {
    alert("❌ رقم الموظف موجود مسبقًا");
    return;
  }

  const { error } = await supabase.from("employees").insert({
    name,
    employee_code: code,
    manager_pin: manager ? pin : null,
    is_manager: manager
  });

  if (error) {
    alert("❌ فشل إضافة الموظف");
    console.error(error);
    return;
  }

  alert("✅ تم إضافة الموظف");
  empName.value = empCode.value = empPin.value = "";
  isManager.checked = false;
  loadEmployees();
};

/* ===============================
   إنشاء / تحديث كوبون شهري
================================ */
window.setCoupon = async function () {
  const code = couponEmpCode.value.trim();
  const amount = Number(couponAmount.value);

  if (!code || !amount) {
    alert("❌ أدخل رقم الموظف والمبلغ");
    return;
  }

  // تحقق أن الموظف موجود
  const { data: emp } = await supabase
    .from("employees")
    .select("id")
    .eq("employee_code", code)
    .maybeSingle();

  if (!emp) {
    alert("❌ رقم الموظف غير موجود");
    return;
  }

  const month = new Date().toISOString().slice(0, 7);

  await supabase
    .from("employee_coupons")
    .delete()
    .eq("employee_code", code)
    .eq("month", month);

  const { error } = await supabase
    .from("employee_coupons")
    .insert({
      employee_code: code,
      month,
      total_amount: amount,
      remaining_amount: amount
    });

  if (error) {
    alert("❌ فشل حفظ الكوبون");
    console.error(error);
    return;
  }

alert("✅ تم حفظ الكوبون");
couponEmpCode.value = "";
couponAmount.value = "";
loadCoupons(); // 👈 هذا السطر فقط
};

/* ===============================
   تعديل موظف
================================ */
window.editEmployee = async function (id, oldName, isManager) {
  const name = prompt("✏️ اسم الموظف:", oldName);
  if (!name) return;

  let updateData = { name };

  if (isManager) {
    const pin = prompt("🔐 رقم المدير (اتركه فارغ بدون تغيير):");
    if (pin) updateData.manager_pin = pin;
  }

  const { error } = await supabase
    .from("employees")
    .update(updateData)
    .eq("id", id);

  if (error) {
    alert("❌ فشل تعديل الموظف");
    console.error(error);
    return;
  }

  alert("✅ تم تعديل الموظف");
  loadEmployees();
};

/* ===============================
   حذف موظف
================================ */
window.deleteEmployee = async function (id, employeeCode, isManager) {
  if (isManager) {
    const pin = prompt("⚠️ هذا مدير\nأدخل رقم المدير للحذف:");
    if (!pin) return;

    const { data } = await supabase
      .from("employees")
      .select("id")
      .eq("id", id)
      .eq("manager_pin", pin)
      .maybeSingle();

    if (!data) {
      alert("❌ الرقم السري غير صحيح");
      return;
    }
  }

  if (!confirm("❗ هل أنت متأكد من حذف الموظف؟")) return;

  // 1️⃣ حذف الكوبونات أولاً
await supabase
  .from("employee_coupons")
  .delete()
  .eq("employee_code", employeeCode);

// 2️⃣ حذف الموظف
const { error } = await supabase
  .from("employees")
  .delete()
  .eq("id", id);
  
  if (error) {
    alert("❌ فشل حذف الموظف");
    console.error(error);
    return;
  }

  alert("🗑 تم حذف الموظف");
loadEmployees();
loadCoupons(); 
};

/* ===============================
   أدوات
================================ */
window.backToCashier = () => location.href = "index.html";
document.addEventListener("DOMContentLoaded", () => {
  loadEmployees();
  loadCoupons(); // 👈 هذا المهم
});

async function loadCoupons() {
  const { data, error } = await supabase
    .from("employee_coupons")
    .select("*")
    .order("month", { ascending: false });

  const box = document.getElementById("couponsList");
  box.innerHTML = "";

  if (error || !data || data.length === 0) {
    box.innerHTML = "<div>لا توجد كوبونات</div>";
    return;
  }

  data.forEach(c => {
    const div = document.createElement("div");
    div.style.borderBottom = "1px dashed #ccc";
    div.style.padding = "8px 0";

    div.innerHTML = `
      <strong>👤 موظف: ${c.employee_code}</strong><br>
      📅 الشهر: ${c.month}<br>
      💳 الإجمالي: ${c.total_amount.toFixed(3)} د.ب<br>
      🟢 المتبقي: ${c.remaining_amount.toFixed(3)} د.ب
    `;

    box.appendChild(div);
  });
}
/* ===============================
   📊 تقرير شهري للكوبونات
================================ */

// فتح التقرير
window.openCouponsReport = function () {
  document.getElementById("couponsReportPanel")?.classList.add("open");
  document.getElementById("panelOverlay")?.classList.add("show");

  const monthInput = document.getElementById("reportMonth");
  if (monthInput && !monthInput.value) {
    monthInput.value = new Date().toISOString().slice(0, 7);
  }
};

// إغلاق التقرير
window.closeCouponsReport = function () {
  document.getElementById("couponsReportPanel")?.classList.remove("open");
  document.getElementById("panelOverlay")?.classList.remove("show");
};

// تحميل التقرير
window.loadCouponsReport = async function () {
  const month = document.getElementById("reportMonth")?.value;
  const box = document.getElementById("couponsReportResult");

  if (!month) {
    alert("❌ اختر الشهر");
    return;
  }

  box.innerHTML = "⏳ جاري تحميل التقرير...";

  const { data, error } = await supabase
    .from("employee_coupons")
    .select("*")
    .eq("month", month)
    .order("employee_code");

  if (error || !data || data.length === 0) {
    box.innerHTML = "<div>❌ لا توجد بيانات لهذا الشهر</div>";
    return;
  }

  let totalAll = 0;
  let remainingAll = 0;

  box.innerHTML = "";

  data.forEach(c => {
    const used = c.total_amount - c.remaining_amount;
    totalAll += c.total_amount;
    remainingAll += c.remaining_amount;

    const status =
      c.remaining_amount <= 0
        ? "🔴 منتهي"
        : c.remaining_amount < c.total_amount * 0.25
        ? "🟠 قرب يخلص"
        : "🟢 طبيعي";

    const div = document.createElement("div");
    div.style.borderBottom = "1px dashed #ccc";
    div.style.padding = "10px 0";

    div.innerHTML = `
      <strong>👤 موظف: ${c.employee_code}</strong><br>
      💳 الكوبون: ${c.total_amount.toFixed(3)} د.ب<br>
      🔻 المستخدم: ${used.toFixed(3)} د.ب<br>
      🟢 المتبقي: ${c.remaining_amount.toFixed(3)} د.ب<br>
      ⚠️ الحالة: ${status}
    `;

    box.appendChild(div);
  });

  const summary = document.createElement("div");
  summary.style.marginTop = "15px";
  summary.style.paddingTop = "10px";
  summary.style.borderTop = "2px solid #000";

  summary.innerHTML = `
    <strong>📊 ملخص الشهر</strong><br>
    💳 إجمالي الكوبونات: ${totalAll.toFixed(3)} د.ب<br>
    🔻 المصروف: ${(totalAll - remainingAll).toFixed(3)} د.ب<br>
    🟢 المتبقي: ${remainingAll.toFixed(3)} د.ب
  `;

  box.appendChild(summary);
};