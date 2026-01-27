import { supabase } from "./supabase.js";

(async () => {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    location.href = "login.html";
  }
})();