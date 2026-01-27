// auth-guard.js
import { supabase } from "./supabase.js";

// نتحقق أول ما الصفحة تفتح
(async () => {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  // إذا ما فيه جلسة → رجّع لتسجيل الدخول
  if (error || !session) {
    // نحفظ الصفحة اللي كان فيها (اختياري – مفيد)
    const currentPage = window.location.pathname;
    if (!currentPage.includes("login.html")) {
      window.location.href = "login.html";
    }
    return;
  }

  // (اختياري) مراقبة أي تسجيل خروج فجائي
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      window.location.href = "login.html";
    }
  });
})();