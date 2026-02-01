import { supabase } from "./supabase.js";

(async () => {
  // ✅ إذا المدير مصادق من قبل
  if (sessionStorage.getItem("admin_auth") === "true") {
    return;
  }

  const pin = prompt("🔐 أدخل رقم المدير:");
  if (!pin) {
    alert("❌ تم الإلغاء");
    location.href = "index.html";
    return;
  }

  const { data, error } = await supabase
    .from("employees")
    .select("id")
    .eq("manager_pin", 1998)
    .eq("is_manager", true)
    .single();

  if (error || !data) {
    alert("❌ رقم المدير غير صحيح");
    location.href = "index.html";
    return;
  }

  // ✅ حفظ المصادقة
  sessionStorage.setItem("admin_auth", "true");
})();