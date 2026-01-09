import { translations } from "./lang.js";

let currentLang = localStorage.getItem("lang") || "ar";

/* تغيير اللغة */
export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem("lang", lang);
  applyLang();
}

/* جلب النص */
export function t(key) {
  return translations[currentLang]?.[key] || key;
}

/* تطبيق اللغة على الصفحة */
export function applyLang() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });

  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
}
