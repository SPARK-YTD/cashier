// admin-guard.js
const ADMIN_PIN = "8899";

(function () {
  const authed = sessionStorage.getItem("admin_auth");

  if (authed === "true") return;

  const pin = prompt("🔐 أدخل رمز الإدارة:");
  if (!pin) {
    alert("❌ تم الإلغاء");
    location.href = "index.html";
    return;
  }

  if (pin !== ADMIN_PIN) {
    alert("❌ رمز الإدارة غير صحيح");
    location.href = "index.html";
    return;
  }

  sessionStorage.setItem("admin_auth", "true");
})();