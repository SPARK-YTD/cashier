import { supabase } from "./supabase.js";

// 🔐 التحقق من أن المستخدم مدير
async function checkAdminAccess() {

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    window.location.replace("employee-login.html");
    return;
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("is_manager")
    .eq("auth_user_id", user.id)
    .single();

  if (!employee || !employee.is_manager) {
    alert("غير مصرح لك بالدخول");
    await supabase.auth.signOut();
    window.location.replace("employee-login.html");
  }
}
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
          onclick="deleteEmployee('${e.id}', '${e.employee_code}')"
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
  const password = empPin.value.trim();
  const manager = isManager.checked;

  if (!name || !code || !password) {
    alert("❌ البيانات كاملة مطلوبة");
    return;
  }

  const email = code + "@staff.local";

  // 1️⃣ إنشاء حساب Auth
  const { data: authData, error: authError } =
    await supabase.auth.signUp({
      email,
      password
    });

  if (authError) {
    alert("❌ فشل إنشاء حساب الدخول");
    console.error(authError);
    return;
  }

  // 2️⃣ حفظ الموظف وربطه بـ auth_user_id
  const { error } = await supabase.from("employees").insert({
    name,
    employee_code: code,
    is_manager: manager,
    auth_user_id: authData.user.id
  });

  if (error) {
    alert("❌ فشل حفظ الموظف");
    console.error(error);
    return;
  }

  alert("✅ تم إنشاء الموظف بنجاح");

  empName.value = "";
  empCode.value = "";
  empPin.value = "";
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
    return;
  }

  alert("✅ تم حفظ الكوبون");
  couponEmpCode.value = "";
  couponAmount.value = "";
  loadCoupons();
};

/* ===============================
   تعديل موظف
================================ */
window.editEmployee = async function (id, oldName, isManager) {
  const name = prompt("✏️ اسم الموظف:", oldName);
  if (!name) return;

  let updateData = { name };


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

 window.deleteEmployee = async function (id, employeeCode) {

  if (!confirm("❗ هل أنت متأكد من حذف الموظف؟")) return;

  // حذف الكوبونات أولاً
  await supabase
    .from("employee_coupons")
    .delete()
    .eq("employee_code", employeeCode);

  // حذف الموظف
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
document.addEventListener("DOMContentLoaded", async () => {

  await checkAdminAccess();  

  loadEmployees();
  loadCoupons();
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
// ربط زر تقرير الكوبونات
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("openCouponsReport")
    ?.addEventListener("click", openCouponsReport);
});

/* ===============================
   📊 تقرير مبيعات الموظفين
================================ */

window.loadEmployeesSalesReport = async function () {

  const box = document.getElementById("employeesSalesReportResult");
  if (!box) return;

  box.innerHTML = "⏳ جاري تحميل التقرير...";

  const { data, error } = await supabase
    .from("order_items")
    .select(`
      qty,
      price,
      products (
        partner_id,
        employees (
          id,
          name
        )
      )
    `);

  if (error) {
    console.error(error);
    box.innerHTML = "❌ خطأ في تحميل التقرير";
    return;
  }

  const report = {};

  (data || []).forEach(row => {

    const emp = row.products?.employees;
    if (!emp) return;

    const total = row.qty * row.price;

    if (!report[emp.id]) {
      report[emp.id] = {
        name: emp.name,
        totalQty: 0,
        totalSales: 0
      };
    }

    report[emp.id].totalQty += row.qty;
    report[emp.id].totalSales += total;

  });

  const result = Object.values(report);

  if (result.length === 0) {
    box.innerHTML = "لا توجد مبيعات مرتبطة بموظفين";
    return;
  }

  box.innerHTML = "";

  result.forEach(emp => {

    const div = document.createElement("div");
    div.style.borderBottom = "1px dashed #ccc";
    div.style.padding = "10px 0";

    div.innerHTML = `
      <strong>👤 ${emp.name}</strong><br>
      🧾 عدد القطع: ${emp.totalQty}<br>
      💰 إجمالي المبيعات: ${emp.totalSales.toFixed(3)} د.ب
    `;

    box.appendChild(div);
  });

};