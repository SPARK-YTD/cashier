/* menu-i18n.js — ترجمة منيو الزبون (عربي افتراضي + English)
   الفكرة: الصفحة تبقى مكتوبة بالعربي، وهذا الملف يترجم الظاهر للزبون فقط (النصوص، التنبيهات، أسماء الأصناف).
   ما يمس البيانات المرسلة للسيرفر ولا رسائل واتساب للمحل — تبقى عربي دائماً. */
(function () {
  "use strict";
  var STORE_KEY = "menu_lang";
  var AR = /[؀-ۿ]/;
  // حرف عربي = حد الكلمة (نمنع الاستبدال داخل كلمة أطول)
  var LETTER = "\\u0600-\\u06FF";

  // ===== القاموس =====
  var D = {
    // عنوان الصفحة والهيدر
    "قائمة الطعام - خذ لك بريك": "Menu - Get Break",
    "🍽️ القائمة": "🍽️ Menu",
    "📋 طلباتي": "📋 My orders",
    "طلباتي": "My orders",
    "تسجيل خروج": "Log out",
    "⏳ جاري التحميل...": "⏳ Loading...",
    "📭 لا توجد منتجات": "📭 No items",
    "⚠️ المنيو للعرض فقط حالياً - استقبال الطلبات متوقف مؤقتاً": "⚠️ Menu is view-only right now - orders are temporarily paused",
    "🛒 السلة": "🛒 Cart",
    "السلة": "Cart",
    "🥤 اختر مشروبك": "🥤 Choose your drink",
    "السعر الأساسي:": "Base price:",
    "🎁 اختر الإضافات (مجاني)": "🎁 Choose extras (free)",
    "💰 إضافات إضافية": "💰 Paid extras",
    "الإضافات الإضافية:": "Paid extras:",
    "الإضافات:": "Extras:",
    "الإجمالي:": "Total:",
    "الإجمالي": "Total",
    "إلغاء": "Cancel",
    "أضف للسلة": "Add to cart",
    "مسح": "Clear",
    "المتابعة": "Continue",
    "📋 بيانات الطلب": "📋 Order details",
    "الاسم *": "Name *",
    "اسمك": "Your name",
    "رقم الهاتف *": "Phone number *",
    "33123456 أو +97333123456": "33123456 or +97333123456",
    "نوع الطلب *": "Order type *",
    "🚶 استلام من العربة": "🚶 Pickup from the cart",
    "🚗 توصيل للعنوان": "🚗 Delivery to address",
    "🚶 التوصيل متوقف حالياً — الاستلام من العربة فقط": "🚶 Delivery is paused - pickup from the cart only",
    "المنطقة *": "Area *",
    "-- اختر المنطقة --": "-- Select area --",
    "رقم المجمع *": "Block number *",
    "رقم الطريق *": "Road number *",
    "رقم المنزل *": "House/Building number *",
    "مثال:": "Example:",
    "📍 موقعك على الخريطة *": "📍 Your location on the map *",
    "📍 تحديد موقعي الحالي": "📍 Use my current location",
    "وصف إضافي للعنوان (اختياري)": "Extra address details (optional)",
    "معالم قريبة، لون الباب، أي تفاصيل تساعد الدليفري...": "Nearby landmarks, door color, anything that helps the driver...",
    "ملاحظات (اختياري)": "Notes (optional)",
    "بدون بصل، حار...": "No onions, spicy...",
    "الطلب:": "Order:",
    "التوصيل:": "Delivery:",
    "إرسال الطلب": "Place order",
    "📱 إرسال وتأكيد عبر واتساب": "📱 Send & confirm via WhatsApp",
    // بوابة الدخول
    "⛔ محاولات خاطئة كثيرة، حاول بعد": "⛔ Too many wrong attempts, try again in",
    "دقيقة": "min",
    "شروط الاستخدام": "Terms of Use",
    "سياسة الخصوصية": "Privacy Policy",
    "👋 أهلاً بك": "👋 Welcome",
    "أدخل رقم هاتفك عشان تدخل المنيو": "Enter your phone number to open the menu",
    "متابعة": "Continue",
    "‹ رجوع": "‹ Back",
    "🔐 أدخل رمزك السري": "🔐 Enter your PIN",
    "حساب برقم": "Account for number",
    "أدخل الرمز المكوّن من 4 أرقام": "enter your 4-digit PIN",
    "الرمز السري": "PIN",
    "دخول": "Log in",
    "❓ نسيت الرمز السري؟": "❓ Forgot your PIN?",
    "🆕 أنشئ رمزك السري": "🆕 Create your PIN",
    "أول مرة تدخل برقم": "First time with number",
    "اختر رمز مكوّن من 4 أرقام تتذكره، عشان تلقى حسابك وطلباتك كل مرة": "choose a 4-digit PIN you'll remember, so you can find your account and orders every time",
    "1️⃣ اختر رمز جديد (4 أرقام)": "1️⃣ Choose a new PIN (4 digits)",
    "2️⃣ أعد كتابة نفس الرمز للتأكيد": "2️⃣ Re-enter the same PIN to confirm",
    "أوافق على": "I agree to the",
    "✅ وافقت على": "✅ You accepted the",
    "عرض": "View",
    "و": "and",
    "إنشاء الحساب والدخول": "Create account & log in",
    "🔄 إعادة تعيين الرمز السري": "🔄 Reset your PIN",
    "المطعم أعاد تفعيل حسابك برقم": "The restaurant reactivated your account for number",
    "اختر رمز سري جديد من 4 أرقام عشان تكمّل": "choose a new 4-digit PIN to continue",
    "1️⃣ الرمز السري الجديد": "1️⃣ New PIN",
    "حفظ الرمز الجديد والدخول": "Save new PIN & log in",
    "⚠️ أدخل رقم هاتف صحيح": "⚠️ Enter a valid phone number",
    "⚠️ حصل خطأ، حاول مرة ثانية": "⚠️ Something went wrong, please try again",
    "⚠️ الرمز 4 أرقام فقط": "⚠️ The PIN must be 4 digits",
    "❌ رمز خاطئ، حاول مرة ثانية": "❌ Wrong PIN, try again",
    "⚠️ الرمز لازم يكون 4 أرقام": "⚠️ The PIN must be 4 digits",
    "⚠️ الرمزين مو متطابقين": "⚠️ The two PINs don't match",
    "⚠️ لازم توافق على شروط الاستخدام وسياسة الخصوصية عشان تكمّل": "⚠️ You must agree to the Terms of Use and Privacy Policy to continue",
    "⚠️ هذا الرقم عنده حساب، ارجع وادخل الرمز السري": "⚠️ This number already has an account, go back and enter the PIN",
    "⚠️ تعذّر إنشاء الحساب، تأكد من الرقم والرمز": "⚠️ Couldn't create the account, check the number and PIN",
    "⚠️ تعذّر تغيير الرمز، تواصل مع المحل": "⚠️ Couldn't change the PIN, please contact the shop",
    "⚠️ رقم واتساب خدمة استعادة الحساب غير متوفر حالياً، تواصل مع المحل مباشرة.": "⚠️ The account-recovery WhatsApp number isn't available right now, please contact the shop directly.",
    "تسجيل خروج من حسابك؟": "Log out of your account?",
    "⏳ تم تسجيل خروجك تلقائياً لعدم النشاط لفترة طويلة، سجّل دخولك مرة ثانية": "⏳ You were logged out automatically after a long period of inactivity, please log in again",
    "🔒 تم إعادة تعيين الرمز السري لحسابك من المطعم، سجّلنا خروجك تلقائياً - اختر رمز جديد عشان تكمّل": "🔒 Your PIN was reset by the restaurant and you were logged out automatically - choose a new PIN to continue",
    "📱 طلبك ينحفظ عندنا، وبعد الإرسال أكّد طلبك عبر واتساب (زر جاهز)": "📱 Your order is saved with us - after sending, confirm it on WhatsApp (ready-made button)",
    "❌ خطأ في التحميل": "❌ Loading error",
    // الأقسام والسلة
    "🍔 الأكل": "🍔 Food",
    "🥤 مشروبات": "🥤 Drinks",
    "🍟 الجانبية": "🍟 Sides",
    "أخرى": "Other",
    "الكل": "All",
    "مشروب": "Drink",
    "لا توجد مشروبات حالياً": "No drinks available right now",
    "د.ب": "BHD",
    "فلس": "fils",
    "دينار": "BD",
    "صنف بدون اسم": "Unnamed item",
    "صنف": "Item",
    "مجاني": "Free",
    "🌶️ سبايسي": "🌶️ Spicy",
    "سبايسي": "Spicy",
    "✅ تمت الإضافة للسلة!": "✅ Added to cart!",
    "🛒 السلة فارغة!": "🛒 Your cart is empty!",
    "❌ حذف": "❌ Remove",
    "بدون:": "Without:",
    "🥤 أضف مشروب": "🥤 Add a drink",
    "هل أنت متأكد؟": "Are you sure?",
    "عادي": "Regular",
    "وجبة": "Meal",
    // مناطق التوصيل
    "باقي مناطق البحرين": "Rest of Bahrain",
    "مناطق طريق البديع": "Budaiya Road areas",
    "مدينة سلمان": "Salman City",
    "البديع": "Budaiya", "الدراز": "Diraz", "باربار": "Barbar", "جنوسان": "Janusan", "كرانة": "Karranah",
    "جد الحاج": "Jid Al Haj", "المقشع": "Maqsha", "بني جمرة": "Bani Jamra", "سار": "Saar", "مقابه": "Maqabah",
    "الجنبية": "Al Janabiyah", "القرية": "Al Qaryah", "المرخ": "Al Markh", "الشاخورة": "Shakhura",
    "ابو صيبع": "Abu Saiba", "الحجر": "Al Hajar", "المنامة": "Manama", "العدلية": "Adliya", "الجفير": "Juffair",
    "أم الحصم": "Umm Al Hassam", "توبلي": "Tubli", "الحورة": "Hoora", "القضيبية": "Qudaibiya", "الزنج": "Zinj",
    "الفاتح": "Fateh", "السلمانية": "Salmaniya", "الماحوز": "Mahooz", "الحد": "Hidd", "المحرق": "Muharraq",
    "عراد": "Arad", "قلالي": "Galali", "سماهيج": "Samaheej", "الديه": "Diyah", "البسيتين": "Busaiteen",
    "جزر أمواج": "Amwaj Islands", "ديلمونيا": "Dilmunia", "درة البحرين": "Durrat Al Bahrain", "نبيه صالح": "Nabih Saleh",
    "حمالة": "Hamala", "مدينة عيسى": "Isa Town", "مدينة حمد": "Hamad Town", "مدينة خليفة": "Khalifa City",
    "كرزكان": "Karzakkan", "الجسرة": "Al Jasra", "الرفاع الشرقي": "East Riffa", "الرفاع الغربي": "West Riffa",
    "الرفاع الشمالي": "North Riffa", "عالي": "Aali", "سترة": "Sitra", "النويدرات": "Nuwaidrat", "المعامير": "Maameer",
    "إيكر": "Eker", "جو": "Jaw", "عسكر": "Askar", "الزلاق": "Zallaq", "الصخير": "Sakhir", "عوالي": "Awali",
    "جدحفص": "Jidhafs", "سنابس": "Sanabis", "كرباباد": "Karbabad", "البلاد القديم": "Bilad Al Qadeem",
    "دمستان": "Damistan", "شهركان": "Shahrakan", "سدد": "Sadad", "سلماباد": "Salmabad", "وادي السيل": "Wadi As Sail",
    "المالكية": "Malkiya", "مناطق أخرى": "Other areas",
    // حالة الطلب
    "تم إرسال طلبك": "Your order was sent",
    "⏳ ينتظر الموافقة من المحل...": "⏳ Waiting for the shop to accept...",
    "راح تتغيّر الصفحة تلقائياً عند القبول": "This page will update automatically once accepted",
    "📱 أكّد طلبك عبر واتساب": "📱 Confirm your order on WhatsApp",
    "طلبك انحفظ عندنا. اضغط الزر وأرسل الرسالة الجاهزة عشان المحل يشوفه فوراً": "Your order is saved. Tap the button and send the ready-made message so the shop sees it right away",
    "📱 تأكيد الطلب عبر واتساب": "📱 Confirm order on WhatsApp",
    "إخفاء (بيستمر الانتظار بالخلفية)": "Hide (waiting continues in the background)",
    "تم الموافقة على طلبك!": "Your order was accepted!",
    "⚠️ خطوة أخيرة مطلوبة": "⚠️ One last step",
    "اضغط الزر الأخضر تحت وأرسل الرسالة الجاهزة عبر واتساب، عشان المحل يتأكد من طلبك ويبدأ التحضير فوراً": "Tap the green button below and send the ready-made message on WhatsApp so the shop can confirm your order and start preparing it right away",
    "📱 اضغط هنا للتأكيد عبر واتساب": "📱 Tap here to confirm on WhatsApp",
    "بعد ما تفتح واتساب، بس اضغط": "After WhatsApp opens, just tap",
    "إرسال": "Send",
    "على الرسالة الجاهزة": "on the ready-made message",
    "الرجاء الانتظار حتى تتم معالجة الطلب بشكل كامل": "Please wait while your order is fully processed",
    "📋 تقدر تتابع حالة طلبك أول بأول من زر": "📋 You can follow your order status anytime from the",
    "بالأعلى بأي وقت": "button at the top",
    "العودة للمنيو": "Back to menu",
    "❌ متصفحك ما يدعم تحديد الموقع": "❌ Your browser doesn't support location",
    "⏳ جاري تحديد موقعك...": "⏳ Getting your location...",
    "✅ تم تحديد موقعك بنجاح": "✅ Location captured",
    "عرض الموقع على الخريطة للتأكد": "View location on the map to double-check",
    "📍 إعادة تحديد الموقع": "📍 Update location",
    "❌ تعذر تحديد موقعك، تأكد من تفعيل صلاحية الموقع للمتصفح": "❌ Couldn't get your location, make sure location permission is enabled for the browser",
    "❌ رفضت صلاحية الموقع، فعّلها من إعدادات المتصفح وحاول مرة ثانية": "❌ Location permission was denied, enable it in browser settings and try again",
    "❌ الرجاء كتابة اسمك (حرفين على الأقل)": "❌ Please enter your name (at least 2 characters)",
    "❌ رقم الهاتف غير صحيح": "❌ Invalid phone number",
    "❌ الرجاء تعبئة المنطقة ورقم المجمع والطريق والمنزل": "❌ Please fill in the area, block, road and house number",
    "📍 الرجاء تحديد موقعك على الخريطة قبل إرسال الطلب": "📍 Please capture your location on the map before placing the order",
    "✓ تأكيد الطلب؟": "✓ Confirm the order?",
    "⏳ جاري الإرسال...": "⏳ Sending...",
    "انتهت جلستك، سجّل دخولك من جديد": "Your session expired, please log in again",
    "أرسلت طلبات كثيرة بوقت قصير، انتظر قليلاً": "You sent too many orders in a short time, please wait a moment",
    "التوصيل متوقف حالياً — الاستلام من العربة فقط": "Delivery is paused - pickup from the cart only",
    "تم تحديث الأسعار، راجع السلة ثم أكّد الطلب من جديد": "Prices were updated, please review your cart and confirm the order again",
    "صنف في سلتك لم يعد متوفراً وتم حذفه، راجع السلة": "An item in your cart is no longer available and was removed, please review your cart",
    "المنطقة المختارة غير صحيحة، اختر المنطقة من جديد": "The selected area is not valid, please choose the area again",
    "تعذّر إرسال الطلب، تأكد من البيانات وحاول مرة ثانية": "Couldn't send the order, check your details and try again",
    "❌ عذراً، تم رفض طلبك من المحل. الرجاء التواصل معهم مباشرة.": "❌ Sorry, the shop declined your order. Please contact them directly.",
    "❌ خطأ في إرسال الطلب:": "❌ Error sending the order:",
    "لا يوجد تفاصيل أصناف": "No item details",
    "🧑‍🍳 طلب موظف": "🧑‍🍳 Staff order",
    "🎉 تم التوصيل": "🎉 Delivered",
    "✅ تم الاستلام": "✅ Picked up",
    "⚠️ بانتظار تأكيدك للطلب عبر واتساب": "⚠️ Waiting for you to confirm on WhatsApp",
    "👨‍🍳 قيد التحضير": "👨‍🍳 Being prepared",
    "🚚 جاهز - بالطريق إليك": "🚚 Ready - on its way to you",
    "✅ جاهز للاستلام": "✅ Ready for pickup",
    "❌ تم رفض الطلب من المطعم": "❌ Declined by the restaurant",
    "🕐 قيد الانتظار - بانتظار موافقة المطعم": "🕐 Pending - waiting for the restaurant to accept",
    "عرض تفاصيل الطلب ▾": "View order details ▾",
    "🧾 طلب جديد (بانتظار الموافقة)": "🧾 New order (awaiting approval)",
    "🧾 فاتورة #": "🧾 Invoice #",
    "🟢 الطلب الحالي": "🟢 Current order",
    "ما فيه طلب نشط حالياً": "No active order right now",
    "📜 سجل الطلبات السابقة": "📜 Previous orders",
    "ما فيه طلبات سابقة": "No previous orders",
    "🚪 تسجيل خروج من الحساب": "🚪 Log out of account",

    // ===== Stage 10: حالة المطعم =====
    "المنيو للعرض فقط حالياً": "Menu is view-only right now",
    "👆 قم بالاختيار": "👆 Tap to choose",
    "متعدد الخيارات": "Multiple options",
    "استقبال الطلبات من المنيو متوقف مؤقتاً. تقدر تتصفح الأصناف والأسعار، وللطلب تواصل معنا أو زرنا في العربة.": "Ordering from the menu is temporarily paused. You can browse items and prices; to order, contact us or visit the cart.",
    "المنيو للعرض فقط حالياً — استقبال الطلبات متوقف مؤقتاً": "The menu is view-only right now — ordering is temporarily paused",
    "👁️ الطلب متوقف حالياً": "👁️ Ordering paused",
    "🔥 العربة مشغولة": "🔥 We're busy",
    "العربة مشغولة حالياً": "We're busy right now",
    "عندنا ضغط طلبات ومو قادرين نستقبل طلبات جديدة الحين.": "We're swamped and can't take new orders right now.",
    "شكراً لتفهمك 🙏": "Thanks for understanding 🙏",
    "الطلب عبر واتساب": "Ordering via WhatsApp",
    "طلبك ينحفظ عندنا، وبعد الإرسال أكّد طلبك عبر واتساب (زر جاهز).": "Your order is saved with us - after sending, confirm it on WhatsApp (ready-made button).",
    "ضغط طلبات حالياً": "High order volume right now",
    "عندنا طلبات كثيرة الحين، فممكن طلبك يتأخر شوي عن المعتاد. تقدر تطلب عادي، وشكراً لصبرك 🙏": "We have many orders right now, so yours may take a bit longer than usual. You can still order as normal - thanks for your patience 🙏",
    "⏳ عندنا طلبات كثيرة حالياً، فممكن يتأخر طلبك شوي. شكراً لصبرك 🙏": "⏳ We have many orders right now, so your order may be slightly delayed. Thanks for your patience 🙏"
  };

  // أنماط فيها أرقام (تُطبّق قبل القاموس)
  var DYN = [
    [/من (\d+(?:\.\d+)?) د\.ب/g, function (_, n) { return "From " + n + " BHD"; }],
    [/نتوقع نفتح الطلبات خلال حوالي (\d+) دقيقة\./g, function (_, n) { return "We expect to reopen orders in about " + n + " min."; }],
    [/العربة مشغولة حالياً، حاول بعد حوالي (\d+) دقيقة/g, function (_, n) { return "We're busy right now, please try again in about " + n + " min"; }]
  ];

  // ===== ترجمة نص =====
  var KEYS = Object.keys(D).sort(function (a, b) { return b.length - a.length; });
  var RES = KEYS.map(function (k) {
    var esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var pre = AR.test(k.charAt(0)) ? "(?<![" + LETTER + "])" : "";
    var post = AR.test(k.charAt(k.length - 1)) ? "(?![" + LETTER + "])" : "";
    return [new RegExp(pre + esc + post, "g"), D[k]];
  });

  var productNames = [];   // [{re, en}] أسماء الأصناف من name_en
  var extraNames = [];     // أسماء خيارات الأصناف (variants) والإضافات المدفوعة
  var baseProducts = [];
  function setProducts(list) { baseProducts = list || []; rebuildNames(); }
  // pairs: [{ar, en}] — أسماء الخيارات/الإضافات اللي لها ترجمة إنجليزية
  function setExtraNames(pairs) { extraNames = pairs || []; rebuildNames(); }
  function rebuildNames() {
    var seen = {};
    productNames = [];
    baseProducts.forEach(function (p) {
      var ar = (p && p.name || "").trim(), en = (p && p.name_en || "").trim();
      if (!ar || !en || seen[ar]) return;
      seen[ar] = 1;
      productNames.push({ ar: ar, en: en });
    });
    extraNames.forEach(function (p) {
      var ar = (p && p.ar || "").trim(), en = (p && p.en || "").trim();
      if (!ar || !en || seen[ar]) return;
      seen[ar] = 1;
      productNames.push({ ar: ar, en: en });
    });
    productNames.sort(function (a, b) { return b.ar.length - a.ar.length; });
    productRes = productNames.map(function (p) {
      var esc = p.ar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return [new RegExp("(?<![" + LETTER + "])" + esc + "(?![" + LETTER + "])", "g"), p.en];
    });
    if (lang === "en") translateAll();
  }
  var productRes = [];

  var PHRASE_RES = RES.filter(function (r, i) { return KEYS[i].indexOf(" ") !== -1; });
  var WORD_RES = RES.filter(function (r, i) { return KEYS[i].indexOf(" ") === -1; });

  function tr(s) {
    if (!s || !AR.test(s)) return s;
    var out = s, i, held = [];
    function hold(re, en) {
      out = out.replace(re, function () { held.push(en); return "\u0001" + (held.length - 1) + "\u0002"; });
    }
    for (i = 0; i < DYN.length; i++) out = out.replace(DYN[i][0], function () { var r = DYN[i][1].apply(null, arguments); held.push(r); return "\u0001" + (held.length - 1) + "\u0002"; });
    // 1) جمل القاموس (أكثر من كلمة) — عشان ما يلتهمها اسم صنف قصير مثل "مشروب"
    for (i = 0; i < PHRASE_RES.length; i++) hold(PHRASE_RES[i][0], PHRASE_RES[i][1]);
    // 2) أسماء الأصناف
    for (i = 0; i < productRes.length; i++) hold(productRes[i][0], productRes[i][1]);
    // 3) كلمات مفردة
    for (i = 0; i < WORD_RES.length; i++) hold(WORD_RES[i][0], WORD_RES[i][1]);
    return out.replace(/\u0001(\d+)\u0002/g, function (_, n) { return held[+n]; });
  }

  // ===== حالة اللغة =====
  var lang = "ar";
  try { lang = localStorage.getItem(STORE_KEY) === "en" ? "en" : "ar"; } catch (e) {}

  var ATTRS = ["placeholder", "title", "label", "aria-label"];

  function walkText(root, fn) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(fn);
  }
  function inSkip(node) {
    var p = node.parentNode;
    if (!p || p.nodeType !== 1) return false;
    return /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName) || !!(p.closest && p.closest("[data-no-i18n]"));
  }

  function applyText(n) {
    if (inSkip(n)) return;
    var v = n.nodeValue;
    if (n.__out !== undefined && v === n.__out) return;   // كتابتنا نحن
    if (lang !== "en") { n.__src = undefined; n.__out = undefined; return; }
    if (!AR.test(v)) { n.__src = undefined; n.__out = undefined; return; }
    var t = tr(v);
    n.__src = v;
    n.__out = t;
    if (t !== v) n.nodeValue = t;
  }
  function restoreText(n) {
    if (n.__src !== undefined && n.__out !== undefined && n.nodeValue === n.__out) n.nodeValue = n.__src;
    n.__src = undefined; n.__out = undefined;
  }
  function applyAttrs(el) {
    if (el.nodeType !== 1) return;
    if (el.closest && el.closest("[data-no-i18n]")) return;
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var v = el.getAttribute(a);
      el.__attr = el.__attr || {};
      var st = el.__attr[a];
      if (st && st.out === v) return;
      if (lang !== "en" || !AR.test(v)) { delete el.__attr[a]; return; }
      var t = tr(v);
      el.__attr[a] = { src: v, out: t };
      if (t !== v) el.setAttribute(a, t);
    });
  }
  function restoreAttrs(el) {
    if (!el.__attr) return;
    Object.keys(el.__attr).forEach(function (a) {
      var st = el.__attr[a];
      if (el.getAttribute(a) === st.out) el.setAttribute(a, st.src);
    });
    el.__attr = {};
  }

  function translateAll() {
    if (!document.body) return;
    observer && observer.disconnect();
    walkText(document.body, applyText);
    document.querySelectorAll("*").forEach(applyAttrs);
    document.title = lang === "en" ? tr(titleSrc) : titleSrc;
    startObserver();
  }
  function restoreAll() {
    observer && observer.disconnect();
    walkText(document.body, restoreText);
    document.querySelectorAll("*").forEach(restoreAttrs);
    document.title = titleSrc;
    startObserver();
  }

  var observer = null, titleSrc = document.title;
  function startObserver() {
    if (!observer) {
      observer = new MutationObserver(function (muts) {
        if (lang !== "en") return;
        observer.disconnect();
        muts.forEach(function (m) {
          if (m.type === "childList") {
            m.addedNodes.forEach(function (nd) {
              if (nd.nodeType === 3) applyText(nd);
              else if (nd.nodeType === 1) {
                walkText(nd, applyText);
                applyAttrs(nd);
                nd.querySelectorAll("*").forEach(applyAttrs);
              }
            });
          } else if (m.type === "characterData") applyText(m.target);
          else if (m.type === "attributes") applyAttrs(m.target);
        });
        startObserver();
      });
    }
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  // ===== تنبيهات المتصفح =====
  var _alert = window.alert.bind(window), _confirm = window.confirm.bind(window);
  window.alert = function (m) { return _alert(lang === "en" ? tr(String(m)) : m); };
  window.confirm = function (m) { return _confirm(lang === "en" ? tr(String(m)) : m); };

  // ===== تبديل اللغة =====
  function updateChrome() {
    var en = lang === "en";
    document.documentElement.lang = en ? "en" : "ar";
    document.documentElement.dir = en ? "ltr" : "rtl";
    document.body.classList.toggle("lang-en", en);
    document.querySelectorAll(".lang-toggle").forEach(function (b) {
      b.textContent = en ? "عربي" : "EN";
      b.setAttribute("aria-label", en ? "التبديل إلى العربية" : "Switch to English");
    });
  }
  function setLang(l) {
    lang = l === "en" ? "en" : "ar";
    try { localStorage.setItem(STORE_KEY, lang); } catch (e) {}
    updateChrome();
    if (lang === "en") translateAll(); else restoreAll();
  }

  function init() {
    titleSrc = document.title;
    document.querySelectorAll(".lang-toggle").forEach(function (b) {
      b.addEventListener("click", function () { setLang(lang === "en" ? "ar" : "en"); });
    });
    updateChrome();
    if (lang === "en") translateAll(); else startObserver();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.MenuI18n = { tr: tr, setLang: setLang, getLang: function () { return lang; }, setProducts: setProducts, setExtraNames: setExtraNames, _dict: D };
})();
