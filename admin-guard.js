import { supabase } from "./supabase.js";

(async () => {
  // إذا سبق التحقق في هذه الجلسة
  if (sessionStorage.getItem("admin_auth") === "true") {
    return;
  }

  const pin = prompt("🔐 أدخل رمز الإدارة:");
  if (!pin) {
    alert("❌ تم الإلغاء");
    location.href = "index.html";
    return;
  }

  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "admin_pin")
    .single();

  if (error || !data) {
    alert("❌ خطأ في إعدادات النظام");
    location.href = "index.html";
    return;
  }

  if (pin !== data.value) {
    alert("❌ رمز الإدارة غير صحيح");
    location.href = "index.html";
    return;
  }

  // ✅ نجاح
  sessionStorage.setItem("admin_auth", "true");
})();