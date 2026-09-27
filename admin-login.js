import { supabase } from "./supabase.js";

let deliveryAccounts = [];

/* ===============================
   تسجيل الدخول (كما هو - يتحقق من كود الموظف + صلاحية مدير)
================================ */
window.loginAdmin = async function () {

  const code = document.getElementById("adminCode").value.trim();
  const pin = document.getElementById("adminPin").value.trim();
  const errorMsg = document.getElementById("errorMsg");

  errorMsg.textContent = "";

  if (!code || !pin) {
    errorMsg.textContent = "أدخل جميع البيانات";
    return;
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("employee_code", code)
    .single();

  if (!employee) {
    errorMsg.textContent = "المستخدم غير موجود";
    return;
  }

  if (!employee.active) {
    errorMsg.textContent = "الحساب موقوف";
    return;
  }

  if (employee.role !== "manager") {
    errorMsg.textContent = "ليس لديك صلاحية دخول الإدارة";
    return;
  }

  if (employee.pin_hash !== pin) {
    errorMsg.textContent = "كلمة المرور غير صحيحة";
    return;
  }

  // إنشاء جلسة مدير
  sessionStorage.setItem("admin_session", JSON.stringify({
    id: employee.id,
    name: employee.name
  }));

  showAdminPanel();
};

window.logoutAdmin = function () {
  sessionStorage.removeItem("admin_session");
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("loginCard").style.display = "block";
  document.getElementById("adminCode").value = "";
  document.getElementById("adminPin").value = "";
};

function showAdminPanel() {
  document.getElementById("loginCard").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";
  loadDeliveryAccounts();
}

// ✅ لو فيه جلسة إدارة شغالة أصلاً (رجع دخل على نفس الصفحة) نطلع له اللوحة على طول
document.addEventListener("DOMContentLoaded", () => {
  const adminSession = sessionStorage.getItem("admin_session");
  if (adminSession) {
    showAdminPanel();
  }
});

/* ===============================
   إدارة حسابات الديلفري
================================ */
async function loadDeliveryAccounts() {
  const { data, error } = await supabase
    .from("delivery_accounts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("❌ LOAD DELIVERY ACCOUNTS ERROR:", error);
    document.getElementById("deliveryTable").innerHTML =
      `<tr><td colspan="4" style="padding:25px;color:#dc2626;">❌ خطأ في تحميل الحسابات</td></tr>`;
    return;
  }

  deliveryAccounts = data || [];
  renderDeliveryTable();
}

function renderDeliveryTable() {
  const box = document.getElementById("deliveryTable");

  if (deliveryAccounts.length === 0) {
    box.innerHTML = `<tr><td colspan="4" style="padding:25px;color:#64748b;">لا يوجد حسابات ديلفري بعد</td></tr>`;
    return;
  }

  box.innerHTML = deliveryAccounts.map(a => `
    <tr>
      <td>${escapeHtml(a.name)}</td>
      <td>${escapeHtml(a.username)}</td>
      <td><span class="badge ${a.active ? "active-badge" : "inactive-badge"}">${a.active ? "نشط" : "موقوف"}</span></td>
      <td>
        <button class="${a.active ? "danger" : "success"}" onclick="toggleDeliveryActive('${a.id}', ${a.active})">
          ${a.active ? "⛔ إيقاف" : "✅ تفعيل"}
        </button>
        <button class="gray" onclick="resetDeliveryPin('${a.id}')">🔑 كلمة المرور</button>
      </td>
    </tr>
  `).join("");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

window.openDeliveryModal = function () {
  document.getElementById("delName").value = "";
  document.getElementById("delUsername").value = "";
  document.getElementById("delPin").value = "";
  document.getElementById("deliveryModal").style.display = "flex";
};

window.closeDeliveryModal = function () {
  document.getElementById("deliveryModal").style.display = "none";
};

window.saveDelivery = async function () {
  const name = document.getElementById("delName").value.trim();
  const username = document.getElementById("delUsername").value.trim();
  const pin = document.getElementById("delPin").value.trim();

  if (!name || !username || !pin) {
    alert("❌ عبّي كل الحقول");
    return;
  }

  const { error } = await supabase
    .from("delivery_accounts")
    .insert({ name, username, pin_hash: pin, active: true });

  if (error) {
    console.error(error);
    if (error.code === "23505") {
      alert("❌ اسم المستخدم هذا مستخدم من قبل، اختر اسم ثاني");
    } else {
      alert("❌ فشل إضافة الحساب: " + error.message);
    }
    return;
  }

  window.closeDeliveryModal();
  await loadDeliveryAccounts();
};

window.toggleDeliveryActive = async function (id, currentlyActive) {
  const { error } = await supabase
    .from("delivery_accounts")
    .update({ active: !currentlyActive })
    .eq("id", id);

  if (error) {
    alert("❌ فشل تحديث الحالة: " + error.message);
    return;
  }

  await loadDeliveryAccounts();
};

window.resetDeliveryPin = async function (id) {
  const newPin = prompt("أدخل كلمة المرور الجديدة:");
  if (!newPin) return;

  const { error } = await supabase
    .from("delivery_accounts")
    .update({ pin_hash: newPin.trim() })
    .eq("id", id);

  if (error) {
    alert("❌ فشل تغيير كلمة المرور: " + error.message);
    return;
  }

  alert("✅ تم تغيير كلمة المرور");
};
