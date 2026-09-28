import { supabase } from "./supabase.js";

window.loginDelivery = async function () {
  const username = document.getElementById("deliveryUsername").value.trim();
  const pin = document.getElementById("deliveryPin").value.trim();
  const errorMsg = document.getElementById("errorMsg");

  errorMsg.textContent = "";

  if (!username || !pin) {
    errorMsg.textContent = "أدخل اسم المستخدم وكلمة المرور";
    return;
  }

  const { data: account, error } = await supabase
    .from("delivery_accounts")
    .select("id, name, username, pin_hash, active")
    .eq("username", username)
    .single();

  if (error || !account) {
    errorMsg.textContent = "الحساب غير موجود";
    return;
  }

  if (!account.active) {
    errorMsg.textContent = "الحساب موقوف";
    return;
  }

  if (account.pin_hash !== pin) {
    errorMsg.textContent = "كلمة المرور غير صحيحة";
    return;
  }

  sessionStorage.setItem("delivery_session", JSON.stringify({
    id: account.id,
    name: account.name,
    username: account.username
  }));

  window.location.href = "delivery.html";
};
