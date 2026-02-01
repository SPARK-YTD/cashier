import { supabase } from "./supabase.js";

(async () => {
  // يطلب الرمز كل مرة (أمان أعلى)
  const inputPin = prompt("🔐 أدخل رمز الإدارة:");
  if (!inputPin) {
    alert("❌ تم الإلغاء");
    location.href = "index.html";
    return;
  }

  // جلب رمز الإدارة من الإعدادات
  const { data, error } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "admin_pin")
    .limit(1);

  if (error || !data || data.length === 0) {
    alert("❌ فشل التحقق من رمز الإدارة");
    console.error(error);
    location.href = "index.html";
    return;
  }

  const realPin = data[0].value;

  if (inputPin !== realPin) {
    alert("❌ رمز الإدارة غير صحيح");
    location.href = "index.html";
    return;
  }

  // ✅ مصادقة ناجحة
  console.log("✅ Admin authenticated");
})();