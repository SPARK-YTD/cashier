import { supabase } from "./supabase.js";

const table = document.getElementById("employeesTable");
const modal = document.getElementById("employeeModal");

window.openModal = () => modal.style.display = "flex";
window.closeModal = () => modal.style.display = "none";

/* ================= LOAD ================= */

async function loadEmployees() {

  const month = new Date().toISOString().slice(0,7);

  const { data: employees, error } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    alert("خطأ في تحميل الموظفين");
    return;
  }

  table.innerHTML = "";

  let totalEmployees = employees?.length || 0;
  let totalCoupons = 0;
  let totalUsage = 0;

  for (const emp of employees || []) {

    const { data: coupon } = await supabase
      .from("employee_coupons")
      .select("*")
      .eq("employee_id", emp.id)
      .eq("month", month)
      .maybeSingle();

    if (coupon) {
      totalCoupons += Number(coupon.total_amount || 0);
      totalUsage += Number(
        (coupon.total_amount || 0) - (coupon.remaining_amount || 0)
      );
    }

    const row = document.createElement("tr");
    
    /* ================= CYCLE ================= */

const { data: openCycle } = await supabase
  .from("employee_cycles")
  .select("*")
  .eq("employee_id", emp.id)
  .eq("status", "open")
  .maybeSingle();

let cycleHtml = `<span style="color:#9ca3af">لا يوجد دورة</span>
<br>
<button class="primary" onclick="openCycleManual('${emp.id}')">
فتح دورة
</button>`;

if (openCycle) {

  const { data: sales } = await supabase
    .from("employee_sales")
    .select("payout_amount, sale_price, quantity")
    .eq("cycle_id", openCycle.id);

  let totalSales = 0;
  let totalCommission = 0;
  let operations = 0;

  if (sales) {
    operations = sales.length;

    totalCommission = sales.reduce(
      (s,i)=> s + Number(i.payout_amount || 0),
      0
    );

    totalSales = sales.reduce(
      (s,i)=> s + (Number(i.sale_price || 0) * Number(i.quantity || 0)),
      0
    );
  }

  // ===== حساب المدفوع =====
  const { data: payouts } = await supabase
    .from("employee_payouts")
    .select("amount")
    .eq("cycle_id", openCycle.id);

  let totalPaid = 0;

  if (payouts) {
    totalPaid = payouts.reduce(
      (s,p)=> s + Number(p.amount || 0),
      0
    );
  }

  const remaining = totalCommission - totalPaid;

  cycleHtml = `
    <div style="color:#16a34a;font-weight:700">
      🟢 دورة مفتوحة
    </div>

    <div style="font-size:12px;color:#6b7280">
      ${openCycle.calculation_mode}
    </div>

    <div style="margin-top:6px;font-size:13px">
      💰 مبيعات: ${totalSales.toFixed(3)} د.ب<br>
      🧮 عمولة: ${totalCommission.toFixed(3)} د.ب<br>
      💵 مدفوع: ${totalPaid.toFixed(3)} د.ب<br>
      ⚖️ المتبقي: ${remaining.toFixed(3)} د.ب
    </div>

    <button class="secondary"
      onclick="openPayModal('${emp.id}','${openCycle.id}',${remaining})">
      💰 دفع
    </button>

    <button class="danger"
      style="margin-top:6px"
      onclick="closeCycle('${emp.id}')">
      إغلاق الدورة
    </button>
  `;
}

    let couponHtml = `<span style="color:#9ca3af">لا يوجد</span>`;

    if (coupon) {

      const low = coupon.remaining_amount <= coupon.total_amount * 0.2;

      couponHtml = `
        <div><strong>${coupon.total_amount.toFixed(3)} د.ب</strong></div>
        <div style="font-size:13px;color:${low ? '#dc2626' : '#374151'}">
          متبقي: ${coupon.remaining_amount.toFixed(3)}
        </div>
        <div style="font-size:12px;color:${coupon.active ? '#16a34a' : '#dc2626'}">
          ${coupon.active ? "مفعل" : "موقوف"}
        </div>
      `;
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
      <td>${couponHtml}</td>
      <td>${cycleHtml}</td>
      <td>
  <button class="primary" onclick="openEditEmployee('${emp.id}')">ملف</button>
  <button class="secondary" onclick="openCouponManager('${emp.id}')">كوبون</button>
  <button class="secondary" onclick="openSupplyManager('${emp.id}')">توريد</button>
  <button class="danger" onclick="deleteEmployee('${emp.id}')">حذف</button>
</td>
    `;

    table.appendChild(row);
  }

  document.getElementById("totalEmployees").textContent = totalEmployees;
  document.getElementById("totalCoupons").textContent = totalCoupons.toFixed(3);
  document.getElementById("totalUsage").textContent = totalUsage.toFixed(3);
}

/* ================= ADD ================= */

window.saveEmployee = async function () {

  const name = empName.value.trim();
  const code = empCode.value.trim();
  const pin = empPin.value.trim();
  const role = empRole.value;

  if (!name || !code || !pin) {
    alert("أدخل جميع البيانات");
    return;
  }

  const { error } = await supabase
    .from("employees")
    .insert({
      name,
      employee_code: code,
      pin_hash: pin,
      role,
      active: true
    });

  if (error) {
    if (error.code === "23505") {
      alert("الرقم الوظيفي مستخدم مسبقاً");
    } else {
      alert("حدث خطأ أثناء الإضافة");
      console.error(error);
    }
    return;
  }

  closeModal();
  loadEmployees();
};
/* ================= SUPPLY ================= */

window.openSupplyManager = async function(empId) {

  // جلب الدورة المفتوحة أو إنشاء واحدة
  let { data: cycle } = await supabase
    .from("employee_cycles")
    .select("*")
    .eq("employee_id", empId)
    .eq("status", "open")
    .maybeSingle();

  if (!cycle) {
    const { data: newCycle } = await supabase
      .from("employee_cycles")
      .insert({
        employee_id: empId,
        status: "open",
        calculation_mode: "supplied_only"
      })
      .select()
      .single();

    cycle = newCycle;
  }

  // جلب أصناف الموظف
  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("partner_id", empId);

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box">
      <h3>إضافة توريد</h3>

      <select id="supplyProduct">
        ${products.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}
      </select>

      <input type="number" id="supplyQty" placeholder="الكمية">

      <input type="date" id="supplyDate">

      <button class="variant-btn" id="saveSupply">حفظ</button>
      <button class="variant-cancel">إغلاق</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  overlay.querySelector("#saveSupply").onclick = async () => {

    const productId = document.getElementById("supplyProduct").value;
    const qty = Number(document.getElementById("supplyQty").value);
    const date = document.getElementById("supplyDate").value;

    if (!productId || !qty || qty <= 0) {
      alert("أدخل بيانات صحيحة");
      return;
    }

    await supabase
  .from("employee_supplies")
  .insert({
    cycle_id: cycle.id,
    employee_id: empId,
    product_id: productId,
    qty: qty,
    supplied_at: date ? new Date(date).toISOString() : new Date().toISOString()
  });

    overlay.remove();
    alert("تم تسجيل التوريد بنجاح");
  };
};
/* ================= EDIT ================= */

window.openEditEmployee = async function(id) {

  const { data: emp } = await supabase
    .from("employees")
    .select("*")
    .eq("id", id)
    .single();

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box">
      <h3>تعديل الموظف</h3>
      <input id="eName" value="${emp.name}">
      <input id="eCode" value="${emp.employee_code}">
      <input id="ePin" value="${emp.pin_hash}">
      <select id="eRole">
        <option value="employee" ${emp.role==="employee"?"selected":""}>موظف</option>
        <option value="manager" ${emp.role==="manager"?"selected":""}>مدير</option>
      </select>
      <button class="variant-btn" id="saveEdit">حفظ</button>
      <button class="variant-cancel">إغلاق</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  overlay.querySelector("#saveEdit").onclick = async () => {

    const { error } = await supabase
      .from("employees")
      .update({
        name: eName.value,
        employee_code: eCode.value,
        pin_hash: ePin.value,
        role: eRole.value
      })
      .eq("id", id);

    if (error) {
      alert("خطأ في التعديل");
      console.error(error);
      return;
    }

    overlay.remove();
    loadEmployees();
  };
};

/* ================= COUPON ================= */

window.openCouponManager = async function(empId) {

  const month = new Date().toISOString().slice(0,7);

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
      <h3>إدارة الكوبون</h3>
      <input type="number" id="amount" value="${coupon?.total_amount || ""}">
      <button class="variant-btn" id="save">حفظ</button>
      ${coupon ? `<button class="variant-btn" id="reset">تصفير</button>` : ""}
      ${coupon ? `<button class="variant-btn" id="toggle">${coupon.active?"إيقاف":"تفعيل"}</button>` : ""}
      <button class="variant-cancel">إغلاق</button>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  overlay.querySelector("#save").onclick = async () => {

  const value = Number(amount.value);
  if (!value || value <= 0) return alert("أدخل مبلغ صحيح");

  if (coupon) {

    const newRemaining =
      coupon.total_amount === value
        ? coupon.remaining_amount
        : value;

    await supabase.from("employee_coupons")
      .update({
     base_amount: value,           
    total_amount: value,
    remaining_amount: newRemaining
    })
    
      .eq("id", coupon.id);

  } else {

    await supabase.from("employee_coupons")
  .insert({
    employee_id: empId,
    month,
    base_amount: value,       
    total_amount: value,
    remaining_amount: value,
    active: true
  });

  }

  overlay.remove();
  loadEmployees();
};

  if (coupon) {
    overlay.querySelector("#reset").onclick = async () => {

  await supabase.from("employee_coupons")
    .update({ remaining_amount: 0 })
    .eq("id", coupon.id);

  overlay.remove();
  loadEmployees();
};

    overlay.querySelector("#toggle").onclick = async () => {
      await supabase.from("employee_coupons")
        .update({ active: !coupon.active })
        .eq("id", coupon.id);
      overlay.remove();
      loadEmployees();
    };
  }
};

/* ================= DELETE ================= */

window.deleteEmployee = async function(id) {
  if (!confirm("تأكيد الحذف؟")) return;
  await supabase.from("employees").delete().eq("id", id);
  loadEmployees();
};

loadEmployees();

/* ================= OPEN CYCLE ================= */

window.openCycleManual = async function(empId) {

  const mode = prompt("نوع الحساب:\n1 = all_sales\n2 = supplied_only");

  let calculation_mode = "all_sales";
  if (mode === "2") calculation_mode = "supplied_only";

  const { error } = await supabase
    .from("employee_cycles")
    .insert({
      employee_id: empId,
      status: "open",
      calculation_mode
    });

  if (error) {
    alert("يوجد دورة مفتوحة بالفعل");
    return;
  }

  loadEmployees();
};

/* ================= CLOSE CYCLE ================= */

window.closeCycle = async function(empId) {

  const managerPin = prompt("🔐 أدخل رقم المدير لإغلاق الدورة");
  if (!managerPin) return;

  const { error } = await supabase
    .rpc("secure_close_cycle", {
      p_employee_id: empId,
      p_manager_pin: managerPin
    });

  if (error) {

    if (error.message.includes("INVALID_MANAGER_PIN")) {
      alert("❌ رقم المدير غير صحيح");
    }
    else if (error.message.includes("CYCLE_HAS_REMAINING")) {
      alert("❌ لا يمكن إغلاق الدورة — يوجد مبلغ متبقي");
    }
    else if (error.message.includes("NO_OPEN_CYCLE")) {
      alert("لا توجد دورة مفتوحة");
    }
    else {
      alert("حدث خطأ أثناء الإغلاق");
      console.error(error);
    }

    return;
  }

  alert("✅ تم إغلاق الدورة بنجاح");
  loadEmployees();
};
  /* ================= PAYOUT ================= */

window.openPayModal = async function(empId, cycleId, remaining){

  if (remaining <= 0){
    alert("لا يوجد مبلغ مستحق");
    return;
  }

  const amount = prompt(
    "أدخل مبلغ الدفع\nالمتبقي: " +
    remaining.toFixed(3) + " د.ب"
  );

  const value = Number(amount);

  if (!value || value <= 0){
    alert("مبلغ غير صحيح");
    return;
  }

  if (value > remaining){
    alert("لا يمكن دفع أكثر من المستحق");
    return;
  }

  const { error } = await supabase
    .from("employee_payouts")
    .insert({
      employee_id: empId,
      cycle_id: cycleId,
      amount: value
    });

  if (error){
    alert("حدث خطأ أثناء تسجيل الدفع");
    return;
  }

  alert("تم تسجيل الدفع بنجاح");
  loadEmployees();
};
/* ================= RESET ALL COUPONS ================= */

window.resetAllCoupons = async function () {

  const pass = prompt("🔐 أدخل كلمة مرور المدير لتأكيد العملية");

  if (pass !== "1998") {   // غيرها لكلمة سر خاصة
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  if (!confirm("⚠️ سيتم إعادة تعيين جميع كوبونات الموظفين")) {
    return;
  }

  const { error } = await supabase
    .rpc("monthly_coupon_reset");

  if (error) {
    alert("❌ فشل إعادة التعيين");
    console.error(error);
    return;
  }

  alert("✅ تم إعادة تعيين الكوبونات بنجاح");
  loadEmployees();
};