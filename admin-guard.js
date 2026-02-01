import { supabase } from "./supabase.js";

(async () => {
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
    alert("❌ فشل التحقق من الرمز");
    location.href = "index.html";
    return;
  }

  if (pin !== data.value) {
    alert("❌ رمز الإدارة غير صحيح");
    location.href = "index.html";
    return;
  }

  console.log("✅ Admin authenticated");
})();