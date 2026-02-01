import { supabase } from "./supabase.js";

(async () => {
  const pin = prompt("🔐 أدخل رمز الإدارة:");
  if (!pin) {
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
    alert("❌ رمز الإدارة غير صحيح");
    location.href = "index.html";
    return;
  }

  // ✅ مسموح له يكمل
})();