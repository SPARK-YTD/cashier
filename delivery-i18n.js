/*********************************
 * i18n مشترك لصفحات الديلفري (delivery-login.html + delivery.html)
 * 3 لغات: عربي (ar) / English (en) / اردو (ur)
 * يحفظ اختيار اللغة بـ localStorage عشان يضل نفس اللغة كل ما يفتح السائق الصفحة
 *********************************/

export const SUPPORTED_LANGS = ["ar", "en", "ur"];
const RTL_LANGS = ["ar", "ur"];
const STORAGE_KEY = "delivery_lang";

const DICT = {
  // ===== تسجيل الدخول =====
  login_title:        { ar: "🚚 دخول الديلفري",              en: "🚚 Driver Login",                 ur: "🚚 ڈرائیور لاگ ان" },
  username_ph:        { ar: "اسم المستخدم",                   en: "Username",                        ur: "یوزر نیم" },
  password_ph:         { ar: "كلمة المرور",                    en: "Password",                        ur: "پاس ورڈ" },
  login_btn:           { ar: "دخول",                           en: "Login",                           ur: "لاگ ان" },
  err_required:        { ar: "أدخل اسم المستخدم وكلمة المرور", en: "Enter username and password",     ur: "یوزر نیم اور پاس ورڈ درج کریں" },
  err_not_found:       { ar: "الحساب غير موجود",               en: "Account not found",               ur: "اکاؤنٹ نہیں ملا" },
  err_inactive:        { ar: "الحساب موقوف",                   en: "Account disabled",                ur: "اکاؤنٹ بند ہے" },
  err_locked:          { ar: "محاولات كثيرة خاطئة. حاول بعد {m} دقيقة", en: "Too many wrong attempts. Try again in {m} min", ur: "بہت زیادہ غلط کوششیں۔ {m} منٹ بعد کوشش کریں" },
  err_session:         { ar: "انتهت الجلسة، سجّل دخولك من جديد", en: "Session expired, please log in again", ur: "سیشن ختم ہو گیا، دوبارہ لاگ ان کریں" },
  err_generic:         { ar: "حصل خطأ، حاول مرة ثانية",        en: "Something went wrong, try again", ur: "کچھ غلط ہو گیا، دوبارہ کوشش کریں" },
  err_wrong_password:  { ar: "كلمة المرور غير صحيحة",          en: "Incorrect password",              ur: "پاس ورڈ غلط ہے" },

  // ===== صفحة التوصيل =====
  page_title:          { ar: "صفحة التوصيل",                   en: "Delivery Page",                   ur: "ڈیلیوری صفحہ" },
  header_title:        { ar: "🚚 صفحة التوصيل",                en: "🚚 Delivery Page",                ur: "🚚 ڈیلیوری صفحہ" },
  welcome_sub:         { ar: "مرحباً {name} - طلبات التوصيل بانتظار التسليم", en: "Welcome {name} - Delivery orders waiting", ur: "خوش آمدید {name} - ڈیلیوری آرڈرز کا انتظار" },
  default_sub:         { ar: "طلبات التوصيل المعتمدة بانتظار التسليم", en: "Confirmed delivery orders waiting", ur: "تصدیق شدہ ڈیلیوری آرڈرز کا انتظار" },
  order_word:          { ar: "طلب",                            en: "orders",                          ur: "آرڈرز" },
  logout_btn:          { ar: "🚪 خروج",                        en: "🚪 Logout",                       ur: "🚪 لاگ آؤٹ" },
  loading:             { ar: "⏳ جاري التحميل...",             en: "⏳ Loading...",                   ur: "⏳ لوڈ ہو رہا ہے..." },
  empty_orders:        { ar: "🚚 لا توجد طلبات توصيل بانتظار التسليم حالياً", en: "🚚 No delivery orders waiting right now", ur: "🚚 اس وقت کوئی ڈیلیوری آرڈر موجود نہیں" },

  location_activating: { ar: "📍 جاري تفعيل مشاركة الموقع...", en: "📍 Activating location sharing...", ur: "📍 لوکیشن شیئرنگ فعال ہو رہی ہے..." },
  location_active:     { ar: "📍 مشاركة الموقع مفعّلة",        en: "📍 Location sharing active",      ur: "📍 لوکیشن شیئرنگ فعال ہے" },
  location_denied:     { ar: "⚠️ فعّل صلاحية الموقع من المتصفح عشان المطعم يشوف مكانك", en: "⚠️ Enable location permission so the restaurant can see you", ur: "⚠️ لوکیشن کی اجازت فعال کریں تاکہ ریسٹورنٹ آپ کو دیکھ سکے" },
  location_no_support: { ar: "⚠️ المتصفح ما يدعم تحديد الموقع", en: "⚠️ Browser doesn't support location", ur: "⚠️ براؤزر لوکیشن سپورٹ نہیں کرتا" },
  location_send_fail:  { ar: "⚠️ تعذر إرسال الموقع",           en: "⚠️ Failed to send location",      ur: "⚠️ لوکیشن بھیجنے میں ناکامی" },

  invoice_prefix:      { ar: "🧾 فاتورة #",                     en: "🧾 Invoice #",                    ur: "🧾 انوائس #" },
  time_now:            { ar: "الآن",                            en: "Now",                             ur: "ابھی" },
  time_minutes_ago:    { ar: "منذ {m} دقيقة",                   en: "{m} min ago",                     ur: "{m} منٹ پہلے" },
  no_name:             { ar: "بدون اسم",                        en: "No name",                         ur: "نام نہیں" },
  no_location:         { ar: "⚠️ العميل ما أرسل موقعه",          en: "⚠️ Customer didn't share location", ur: "⚠️ کسٹمر نے لوکیشن شیئر نہیں کی" },
  open_map:            { ar: "🗺 فتح الموقع في خرائط قوقل",       en: "🗺 Open location in Google Maps", ur: "🗺 گوگل میپس میں لوکیشن کھولیں" },
  route_btn:           { ar: "🗺 عرض المسار على الخريطة",        en: "🗺 Show route on map",            ur: "🗺 نقشے پر راستہ دیکھیں" },
  route_title:         { ar: "المسار إلى الزبون",                 en: "Route to customer",               ur: "کسٹمر تک راستہ" },
  route_eta:           { ar: "⏱ ~{m} د",                          en: "⏱ ~{m} min",                      ur: "⏱ ~{m} منٹ" },
  route_loading:       { ar: "جاري حساب المسار...",               en: "Calculating route...",            ur: "راستہ معلوم ہو رہا ہے..." },
  route_approx:        { ar: "مسار تقريبي (خدمة المسارات غير متاحة حالياً)", en: "Approximate route (routing service unavailable)", ur: "تقریبی راستہ (روٹنگ سروس دستیاب نہیں)" },
  route_waiting_gps:   { ar: "بانتظار موقعك... فعّل الموقع في الجوال", en: "Waiting for your location... enable GPS", ur: "آپ کی لوکیشن کا انتظار... GPS آن کریں" },
  route_you:           { ar: "أنت",                               en: "You",                             ur: "آپ" },
  route_customer:      { ar: "الزبون",                            en: "Customer",                        ur: "کسٹمر" },
  route_recenter:      { ar: "🎯 توسيط",                          en: "🎯 Recenter",                     ur: "🎯 مرکز" },
  route_google:        { ar: "🧭 ملاحة صوتية (قوقل)",             en: "🧭 Voice navigation (Google)",    ur: "🧭 وائس نیویگیشن (گوگل)" },
  route_alt_label:     { ar: "مسار {n} · {m} د · {d}",            en: "Route {n} · {m} min · {d}",       ur: "راستہ {n} · {m} منٹ · {d}" },
  route_alts_title:    { ar: "اختر مسارك (يشوفه المطعم):",       en: "Choose your route (the restaurant sees it):", ur: "اپنا راستہ چنیں (ریسٹورنٹ دیکھ سکتا ہے):" },
  route_saved:         { ar: "✔ مسارك محفوظ والمطعم يشوفه",       en: "✔ Your route is saved and visible to the restaurant", ur: "✔ آپ کا راستہ محفوظ ہے اور ریسٹورنٹ دیکھ سکتا ہے" },
  route_save_fail:     { ar: "⚠️ ما انحفظ المسار عند المطعم، جرّب مرة ثانية", en: "⚠️ Route was not saved for the restaurant, try again", ur: "⚠️ راستہ ریسٹورنٹ کے لیے محفوظ نہیں ہوا، دوبارہ کوشش کریں" },
  route_off:           { ar: "⚠️ ابتعدت عن المسار — اضغط تحديث المسارات", en: "⚠️ You are off the route — tap Refresh routes", ur: "⚠️ آپ راستے سے ہٹ گئے ہیں — راستے ریفریش کریں" },
  route_refresh:       { ar: "🔄 تحديث المسارات",                 en: "🔄 Refresh routes",               ur: "🔄 راستے ریفریش" },
  gps_stopped:         { ar: "⚠️ موقعك وقف! افتح الصفحة وفعّل الموقع عشان المطعم يشوفك", en: "⚠️ Your location stopped! Keep this page open and enable GPS so the restaurant can see you", ur: "⚠️ آپ کی لوکیشن رک گئی! صفحہ کھلا رکھیں اور GPS آن کریں" },
  order_amount_label:  { ar: "🧾 مبلغ الطلب:",                    en: "🧾 Order amount:",                ur: "🧾 آرڈر کی رقم:" },
  fee_label:           { ar: "💰 رسوم التوصيل:",                 en: "💰 Delivery fee:",                ur: "💰 ڈیلیوری فیس:" },
  collect_total_label: { ar: "💵 المطلوب تحصيله من الزبون:",      en: "💵 Total to collect from customer:", ur: "💵 کسٹمر سے وصول کرنی رقم:" },
  paid_badge:          { ar: "✅ الطلب مدفوع",                    en: "✅ Order paid",                   ur: "✅ آرڈر ادا شدہ ہے" },
  unpaid_badge:        { ar: "❌ غير مدفوع - حصّل عند التسليم",   en: "❌ Not paid - collect on delivery", ur: "❌ ادائیگی نہیں ہوئی - ڈیلیوری پر وصول کریں" },
  paid_via:            { ar: "دفع عبر: ",                         en: "Paid via: ",                      ur: "ادائیگی کا طریقہ: " },
  pay_method_cash:     { ar: "كاش",                                en: "Cash",                             ur: "کیش" },
  pay_method_benefit:  { ar: "بنفت/كارد",                          en: "Benefit/Card",                    ur: "بینیفٹ/کارڈ" },
  pay_method_employee: { ar: "موظف",                                en: "Employee",                        ur: "ملازم" },
  kitchen_ready:       { ar: "🟢 الطلب جاهز من المطبخ",          en: "🟢 Order ready from kitchen",     ur: "🟢 آرڈر کچن سے تیار ہے" },
  kitchen_waiting:     { ar: "⏳ الطلب قيد التحضير",             en: "⏳ Order being prepared",          ur: "⏳ آرڈر تیار ہو رہا ہے" },

  claim_btn:           { ar: "🚴 راح أوصلها أنا",                en: "🚴 I'll deliver this",            ur: "🚴 میں یہ ڈیلیور کروں گا" },
  claim_mine:          { ar: "🚴 انت مستلم هالطلب",              en: "🚴 You've claimed this order",    ur: "🚴 آپ نے یہ آرڈر لے لیا ہے" },
  claim_other:         { ar: "🚴 مستلمة من سائق ثاني",           en: "🚴 Claimed by another driver",    ur: "🚴 یہ آرڈر دوسرے ڈرائیور نے لے لیا ہے" },
  claim_fail:          { ar: "❌ فشل استلام الطلب: ",             en: "❌ Failed to claim order: ",       ur: "❌ آرڈر لینے میں ناکامی: " },
  claim_race:          { ar: "⚠️ سائق ثاني استلم الطلب قبلك بلحظات", en: "⚠️ Another driver just claimed it", ur: "⚠️ دوسرے ڈرائیور نے ابھی لے لیا" },

  delivered_btn:       { ar: "✅ تم التوصيل",                    en: "✅ Delivered",                    ur: "✅ ڈیلیور ہو گیا" },
  delivered_confirm:   { ar: "تأكيد أن الطلب وصل للعميل فعلاً؟", en: "Confirm the order really reached the customer?", ur: "کیا آرڈر واقعی کسٹمر تک پہنچ گیا ہے؟" },
  delivered_progress:  { ar: "⏳ جارِ التأكيد...",               en: "⏳ Confirming...",                ur: "⏳ تصدیق ہو رہی ہے..." },
  delivered_fail:      { ar: "❌ حصل خطأ أثناء تأكيد التوصيل: ", en: "❌ Error confirming delivery: ",   ur: "❌ ڈیلیوری کی تصدیق میں خرابی: " },

  no_location_alert:   { ar: "⚠️ ما فيه موقع محدث لهذا الطلب",   en: "⚠️ No location for this order",   ur: "⚠️ اس آرڈر کی کوئی لوکیشن نہیں" },

  // ===== تأكيد الدفع عند التسليم =====
  payment_confirm_title: { ar: "💰 تأكيد استلام الدفع",           en: "💰 Confirm payment received",     ur: "💰 ادائیگی کی تصدیق کریں" },
  payment_confirm_sub:   { ar: "اختر الطريقة اللي دفع فيها الزبون", en: "Choose how the customer paid",    ur: "کسٹمر نے کس طریقے سے ادائیگی کی؟" },
  payment_confirm_note_only: { ar: "📝 هذا إشعار للمطعم بس - ما يسجل كدفعة رسمية", en: "📝 This just notifies the restaurant - not recorded as an official payment", ur: "📝 یہ صرف ریسٹورنٹ کے لیے اطلاع ہے - سرکاری ادائیگی کے طور پر درج نہیں ہوتی" },
  pay_cash_btn:           { ar: "💵 كاش",                          en: "💵 Cash",                          ur: "💵 کیش" },
  pay_card_btn:           { ar: "💳 بطاقة",                        en: "💳 Card",                          ur: "💳 کارڈ" },
  payment_confirm_cancel: { ar: "إلغاء",                           en: "Cancel",                          ur: "منسوخ کریں" },

  // ===== تثبيت الصفحة كتطبيق (PWA) =====
  install_app_btn: { ar: "📲 ثبّت التطبيق على شاشتك", en: "📲 Install app on your screen", ur: "📲 ایپ اپنی اسکرین پر انسٹال کریں" },
  ios_install_hint: { ar: "📲 عشان أفضل تتبع: اضغط زر المشاركة بالمتصفح ثم \"إضافة إلى الشاشة الرئيسية\"", en: "📲 For best tracking: tap the browser share button, then \"Add to Home Screen\"", ur: "📲 بہتر ٹریکنگ کے لیے: براؤزر کا شیئر بٹن دبائیں پھر \"ہوم اسکرین پر شامل کریں\"" }
};

function getLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LANGS.includes(saved) ? saved : "ar";
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  localStorage.setItem(STORAGE_KEY, lang);
  applyDirection(lang);
}

function applyDirection(lang) {
  const isRtl = RTL_LANGS.includes(lang);
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
}

function t(key, params) {
  const entry = DICT[key];
  if (!entry) return key;
  let text = entry[getLang()] || entry.ar || key;
  if (params) {
    Object.keys(params).forEach(p => {
      text = text.replace(`{${p}}`, params[p]);
    });
  }
  return text;
}

// ✅ يطبق الترجمة على أي عنصر بالصفحة عليه data-i18n="key"
// (للعناصر الثابتة اللي ما تتغير من JS)
function applyStaticTranslations() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    el.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    el.setAttribute("placeholder", t(key));
  });
  document.title = t("page_title");
}

// ✅ يبني شريط اختيار اللغة (عربي / English / اردو) ويحقنه بالصفحة
function renderLanguageSwitcher(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const langLabels = { ar: "عربي", en: "English", ur: "اردو" };
  container.innerHTML = SUPPORTED_LANGS.map(l => `
    <button
      class="lang-btn${l === getLang() ? " active" : ""}"
      data-lang="${l}"
      onclick="window.__setDeliveryLang('${l}')"
    >${langLabels[l]}</button>
  `).join("");
}

window.__setDeliveryLang = function (lang) {
  setLang(lang);
  window.__onLangChange && window.__onLangChange();
};

// أول تحميل: طبّق الاتجاه فورًا (قبل ما تترسم أي عناصر) عشان ما يصير وميض RTL/LTR
applyDirection(getLang());

export { getLang, setLang, applyDirection, t, applyStaticTranslations, renderLanguageSwitcher };
