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

  const { data: account, error } = await supabase
    .from("delivery_accounts")
    .select("id, name, username, pin_hash, active")
    .eq("username", username)
    .single();

  if (error || !account) {
    errorMsg.textContent = t("err_not_found");
    return;
  }

  if (!account.active) {
    errorMsg.textContent = t("err_inactive");
    return;
  }

  if (account.pin_hash !== pin) {
    errorMsg.textContent = t("err_wrong_password");
    return;
  }

  sessionStorage.setItem("delivery_session", JSON.stringify({
    id: account.id,
    name: account.name,
    username: account.username
  }));

  window.location.href = "delivery.html";
};
