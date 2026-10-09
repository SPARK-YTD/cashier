// auth-guard.js — بوابة الدخول لكل صفحات الكاشير والإدارة
// الصفحة تبقى مخفية حتى يتأكد وجود جلسة حساب المحل، وإلا تحوّل لصفحة الدخول.
// ملاحظة: هذي طبقة واجهة فقط. الحماية الحقيقية هي RLS في قاعدة البيانات.
import { supabase } from "./supabase.js";

document.documentElement.style.visibility = "hidden";

function goLogin() {
  try {
    const here = location.pathname.split("/").pop() || "index.html";
    if (here !== "login.html") sessionStorage.setItem("next_page", here);
  } catch (_) {}
  location.replace("login.html");
}

(async () => {
  let session = null;
  try {
    const r = await supabase.auth.getSession();
    session = r.data && r.data.session;
    if (session) {
      // نتأكد من الخادم أن الجلسة صالحة فعلا (مو مجرد توكن مخزن)
      const u = await supabase.auth.getUser();
      if (u.error || !u.data || !u.data.user) session = null;
    }
  } catch (_) { session = null; }

  if (!session) { goLogin(); return; }

  document.documentElement.style.visibility = "";
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") goLogin();
  });
})();
