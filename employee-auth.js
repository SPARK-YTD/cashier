import { supabase } from "./supabase.js";
import { t, applyStaticTranslations, renderLanguageSwitcher } from "./delivery-i18n.js";

document.addEventListener("DOMContentLoaded", () => {
  applyStaticTranslations();
  renderLanguageSwitcher("langSwitcher");
});

window.__onLangChange = function () {
  applyStaticTranslations();
  renderLanguageSwitcher("langSwitcher");
};

window.loginDelivery = async function () {
  const username = document.getElementById("deliveryUsername").value.trim();
  const pin = document.getElementById("deliveryPin").value.trim();
  const errorMsg = document.getElementById("errorMsg");

  errorMsg.textContent = "";

  if (!username || !pin) {
    errorMsg.textContent = t("err_required");
    return;
  }

  const { data: res, error } = await supabase.rpc("driver_login", {
    p_username: username,
    p_pin: pin
  });

  if (error || !res) {
    errorMsg.textContent = t("err_generic");
    return;
  }

  if (!res.ok) {
    if (res.error === "LOCKED") {
      errorMsg.textContent = t("err_locked", { m: Math.ceil((res.retry_after || 60) / 60) });
    } else if (res.error === "INACTIVE") {
      errorMsg.textContent = t("err_inactive");
    } else {
      // لا نفرّق بين "المستخدم غير موجود" و"كلمة المرور خطأ" (يمنع تخمين أسماء المستخدمين)
      errorMsg.textContent = t("err_wrong_password");
    }
    return;
  }

  sessionStorage.setItem("delivery_session", JSON.stringify({
    id: res.account.id,
    name: res.account.name,
    username: res.account.username,
    token: res.token
  }));

  window.location.href = "delivery.html";
};
