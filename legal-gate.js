/* legal-gate.js — شاشة الموافقة الإلزامية على الشروط والخصوصية (عربي / English)
   الاستخدام: LegalGate.require({ mode:"register"|"update", supportPhone, onAccept, onDecline })
   - الزبون لازم يقرأ الوثيقتين لآخرهما (الشروط ثم الخصوصية) قبل ما يتفعّل مربع الموافقة.
   - المحتوى يُقرأ من terms.html / privacy.html (مصدر واحد للصفحة العامة وللشاشة).
   - onAccept: دالة (ممكن async)، لو رجّعت false أو رمت خطأ تبقى الشاشة مفتوحة وتظهر رسالة. */
(function () {
  "use strict";
  var DOCS = { terms: "terms.html", privacy: "privacy.html" };
  var ORDER = ["terms", "privacy"];

  var S = {
    ar: {
      titleRegister: "قبل ما تكمّل: الشروط والخصوصية",
      titleUpdate: "تحديث الشروط وسياسة الخصوصية",
      introRegister: "لازم تقرأ الوثيقتين حتى النهاية وتوافق عليهما عشان تقدر تنشئ حسابك وتستخدم المنيو.",
      introUpdate: "حدّثنا الشروط وسياسة الخصوصية. اقرأهما حتى النهاية ووافق عليهما عشان تكمّل استخدام المنيو.",
      terms: "شروط الاستخدام", privacy: "سياسة الخصوصية",
      step: "الخطوة", of: "من",
      scrollHint: "⬇ مرّر للأسفل حتى نهاية الوثيقة",
      read: "✓ تمت القراءة",
      progress: "تقدّم القراءة",
      next: "التالي: سياسة الخصوصية ›",
      agree: "قرأت شروط الاستخدام وسياسة الخصوصية وأوافق عليهما",
      agreeLocked: "اقرأ الوثيقتين حتى النهاية لتفعيل الموافقة",
      accept: "أوافق وأتابع",
      declineRegister: "رجوع",
      declineUpdate: "لا أوافق - تسجيل خروج",
      loading: "⏳ جاري تحميل الوثيقة...",
      loadError: "❌ تعذّر تحميل الوثيقة. تأكد من الاتصال وحاول مرة ثانية.",
      retry: "إعادة المحاولة",
      saving: "⏳ جاري الحفظ...",
      saveError: "❌ تعذّر حفظ موافقتك، حاول مرة ثانية.",
      contact: "للتواصل:",
      langBtn: "English"
    },
    en: {
      titleRegister: "Before you continue: Terms & Privacy",
      titleUpdate: "Updated Terms & Privacy Policy",
      introRegister: "You must read both documents to the end and accept them before you can create your account and use the menu.",
      introUpdate: "We updated our Terms and Privacy Policy. Please read them to the end and accept to keep using the menu.",
      terms: "Terms of Use", privacy: "Privacy Policy",
      step: "Step", of: "of",
      scrollHint: "⬇ Scroll down to the end of the document",
      read: "✓ Read",
      progress: "Reading progress",
      next: "Next: Privacy Policy ›",
      agree: "I have read the Terms of Use and Privacy Policy and I agree to them",
      agreeLocked: "Read both documents to the end to enable acceptance",
      accept: "I agree & continue",
      declineRegister: "Back",
      declineUpdate: "I disagree - log out",
      loading: "⏳ Loading document...",
      loadError: "❌ Couldn't load the document. Check your connection and try again.",
      retry: "Retry",
      saving: "⏳ Saving...",
      saveError: "❌ Couldn't save your acceptance, please try again.",
      contact: "Contact:",
      langBtn: "عربي"
    }
  };

  var CSS =
    "#lgOverlay{position:fixed;inset:0;z-index:3000;background:rgba(17,24,39,.96);display:flex;align-items:stretch;justify-content:center;font-family:system-ui,-apple-system,'Segoe UI',Tahoma,Arial,sans-serif}" +
    "#lgBox{background:#fff;width:min(760px,100%);display:flex;flex-direction:column;height:100%;max-height:100dvh;color:#111827}" +
    "@media(min-width:800px){#lgOverlay{padding:20px}#lgBox{border-radius:16px;overflow:hidden}}" +
    "#lgHead{padding:14px 16px 10px;border-bottom:1px solid #e5e7eb}" +
    "#lgTop{display:flex;align-items:center;justify-content:space-between;gap:10px}" +
    "#lgTitle{font-size:17px;font-weight:800;margin:0}" +
    "#lgLang{border:0;background:#EEF2FF;color:#3730A3;border-radius:16px;padding:6px 12px;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;flex-shrink:0}" +
    "#lgIntro{margin:6px 0 10px;font-size:13px;color:#4b5563;line-height:1.6}" +
    "#lgTabs{display:flex;gap:8px}" +
    ".lg-tab{flex:1;border:2px solid #e5e7eb;background:#f9fafb;color:#374151;border-radius:10px;padding:8px 6px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit}" +
    ".lg-tab.on{border-color:#10b981;background:#ecfdf5;color:#065f46}" +
    ".lg-tab.done::after{content:' ✓';color:#059669}" +
    "#lgBar{height:5px;background:#e5e7eb;border-radius:3px;margin-top:10px;overflow:hidden}" +
    "#lgBarFill{height:100%;width:0;background:#10b981;transition:width .15s}" +
    "#lgMeta{display:flex;justify-content:space-between;font-size:12px;color:#6b7280;margin-top:4px}" +
    "#lgBody{flex:1;overflow-y:auto;padding:4px 16px 20px;background:#f3f4f6;-webkit-overflow-scrolling:touch;scroll-behavior:auto}" +
    "#lgBody .card{background:#fff;border-radius:12px;padding:18px;margin-top:14px;box-shadow:0 2px 8px rgba(0,0,0,.05);line-height:1.9;font-size:14px}" +
    "#lgBody h2{font-size:15px;margin:0 0 8px;color:#0F172A}" +
    "#lgBody[dir=rtl] h2{border-right:4px solid #F59E0B;padding-right:10px}" +
    "#lgBody[dir=ltr] h2{border-left:4px solid #F59E0B;padding-left:10px}" +
    "#lgBody[dir=rtl] ul{padding-right:20px}#lgBody[dir=ltr] ul{padding-left:20px}" +
    "#lgBody li{margin-bottom:6px}#lgBody .updated{text-align:center;font-size:12px;color:#6b7280;margin:18px 0 6px}" +
    "#lgBody .contact-box{background:#FFFBEB;border:1px solid #FDE68A;border-radius:10px;padding:12px;margin-top:8px}" +
    "#lgBody a{color:#D97706;font-weight:700}" +
    "#lgState{padding:30px 10px;text-align:center;color:#6b7280;font-size:14px}" +
    "#lgState button{margin-top:12px;border:0;background:#111827;color:#fff;border-radius:10px;padding:9px 18px;font-weight:700;cursor:pointer;font-family:inherit}" +
    "#lgFoot{border-top:1px solid #e5e7eb;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:#fff}" +
    "#lgHint{font-size:12px;color:#92400E;background:#FEF3C7;border-radius:8px;padding:6px 10px;margin-bottom:10px;text-align:center}" +
    "#lgAgree{display:flex;gap:10px;align-items:flex-start;font-size:13px;line-height:1.6;font-weight:600;margin-bottom:10px;color:#111827}" +
    "#lgAgree input{width:20px;height:20px;margin-top:2px;flex-shrink:0}" +
    "#lgAgree.locked{opacity:.45}" +
    "#lgErr{color:#DC2626;font-size:13px;font-weight:700;margin-bottom:8px;text-align:center;min-height:0}" +
    "#lgBtns{display:flex;gap:10px}" +
    "#lgBtns button{flex:1;border:0;border-radius:12px;padding:13px;font-weight:800;font-size:15px;cursor:pointer;font-family:inherit}" +
    "#lgAccept{background:#10b981;color:#fff}#lgAccept:disabled{background:#d1d5db;color:#6b7280;cursor:not-allowed}" +
    "#lgNext{background:#111827;color:#fff}" +
    "#lgDecline{background:#f3f4f6;color:#374151;flex:0 0 auto!important;padding:13px 16px!important}";

  var cache = {};     // key: doc|lang -> {html}
  var state = null;   // الجلسة الحالية للشاشة

  function curLang() {
    try { if (window.MenuI18n && window.MenuI18n.getLang) return window.MenuI18n.getLang() === "en" ? "en" : "ar"; } catch (e) {}
    try { return localStorage.getItem("menu_lang") === "en" ? "en" : "ar"; } catch (e) {}
    return "ar";
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function loadDoc(doc, lang) {
    var key = doc + "|" + lang;
    if (cache[key]) return Promise.resolve(cache[key]);
    return fetch(DOCS[doc], { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (txt) {
      var d = new DOMParser().parseFromString(txt, "text/html");
      var sec = d.querySelector('section.lang-block[lang="' + lang + '"]');
      if (!sec) throw new Error("NO_SECTION");
      sec.querySelectorAll("script").forEach(function (n) { n.remove(); });
      var out = { html: sec.innerHTML };
      cache[key] = out;
      return out;
    });
  }

  function ensureStyle() {
    if (document.getElementById("lgStyle")) return;
    var st = document.createElement("style");
    st.id = "lgStyle"; st.textContent = CSS;
    document.head.appendChild(st);
  }

  function close() {
    var o = document.getElementById("lgOverlay");
    if (o) o.remove();
    document.body.style.overflow = state && state.prevOverflow !== undefined ? state.prevOverflow : "";
    state = null;
  }

  function atEnd(el) { return el.scrollTop + el.clientHeight >= el.scrollHeight - 28; }

  function render() {
    var st = state; if (!st) return;
    var L = S[st.lang];
    var o = document.getElementById("lgOverlay");
    o.setAttribute("dir", st.lang === "en" ? "ltr" : "rtl");
    o.querySelector("#lgTitle").textContent = st.mode === "update" ? L.titleUpdate : L.titleRegister;
    o.querySelector("#lgIntro").textContent = st.mode === "update" ? L.introUpdate : L.introRegister;
    o.querySelector("#lgLang").textContent = L.langBtn;
    o.querySelector("#lgMetaLbl").textContent = L.progress;
    ORDER.forEach(function (d) {
      var t = o.querySelector('.lg-tab[data-d="' + d + '"]');
      t.textContent = (ORDER.indexOf(d) + 1) + ". " + L[d];
      t.classList.toggle("on", st.doc === d);
      t.classList.toggle("done", !!st.read[d]);
    });
    o.querySelector("#lgAgreeText").textContent = allRead() ? L.agree : L.agreeLocked;
    o.querySelector("#lgAccept").textContent = L.accept;
    o.querySelector("#lgDecline").textContent = st.mode === "update" ? L.declineUpdate : L.declineRegister;
    o.querySelector("#lgNext").textContent = L.next;
    refreshControls();
    showDoc();
  }

  function allRead() { return ORDER.every(function (d) { return state.read[d]; }); }

  function refreshControls() {
    var st = state; if (!st) return;
    var L = S[st.lang], o = document.getElementById("lgOverlay");
    var all = allRead();
    var cb = o.querySelector("#lgAgreeBox");
    cb.disabled = !all;
    if (!all) cb.checked = false;
    o.querySelector("#lgAgree").classList.toggle("locked", !all);
    o.querySelector("#lgAgreeText").textContent = all ? L.agree : L.agreeLocked;
    o.querySelector("#lgAccept").disabled = !(all && cb.checked) || st.busy;
    // سطر التلميح + زر "التالي"
    var curRead = !!st.read[st.doc];
    var hint = o.querySelector("#lgHint");
    hint.style.display = curRead ? "none" : "block";
    hint.textContent = L.scrollHint;
    var next = o.querySelector("#lgNext");
    next.style.display = (curRead && st.doc === "terms") ? "block" : "none";
    o.querySelector("#lgAccept").style.display = (st.doc === "privacy" || all) ? "block" : "none";
    o.querySelectorAll(".lg-tab").forEach(function (t) { t.classList.toggle("done", !!st.read[t.dataset.d]); });
  }

  function updateProgress() {
    var st = state; if (!st) return;
    var b = document.getElementById("lgBody");
    var max = b.scrollHeight - b.clientHeight;
    var pct = max <= 0 ? 100 : Math.min(100, Math.round((b.scrollTop / max) * 100));
    document.getElementById("lgBarFill").style.width = (st.read[st.doc] ? 100 : pct) + "%";
    document.getElementById("lgPct").textContent = (st.read[st.doc] ? 100 : pct) + "%";
    if (!st.read[st.doc] && st.loaded && atEnd(b)) { st.read[st.doc] = true; document.getElementById("lgBarFill").style.width = "100%"; document.getElementById("lgPct").textContent = "100%"; refreshControls(); render_tabsOnly(); }
  }
  function render_tabsOnly() {
    var st = state, L = S[st.lang];
    document.querySelectorAll(".lg-tab").forEach(function (t) { t.classList.toggle("done", !!st.read[t.dataset.d]); });
  }

  function showDoc() {
    var st = state; if (!st) return;
    var o = document.getElementById("lgOverlay"), L = S[st.lang];
    var body = o.querySelector("#lgBody");
    var token = ++st.token;
    st.loaded = false;
    body.setAttribute("dir", st.lang === "en" ? "ltr" : "rtl");
    body.setAttribute("lang", st.lang);
    body.innerHTML = '<div id="lgState">' + esc(L.loading) + '</div>';
    body.scrollTop = 0;
    updateProgress();
    loadDoc(st.doc, st.lang).then(function (d) {
      if (!state || token !== state.token) return;
      body.innerHTML = d.html;
      // رقم التواصل
      var phone = st.supportPhone ? String(st.supportPhone) : "";
      body.querySelectorAll(".waLink").forEach(function (a) {
        if (phone) {
          a.href = "https://wa.me/" + phone.replace(/[^\d]/g, "");
          a.textContent = (st.lang === "en" ? "WhatsApp: " : "واتساب: ") + phone;
        } else {
          var box = a.closest(".contact-box"); if (box) box.remove();
        }
      });
      body.scrollTop = 0;
      st.loaded = true;
      requestAnimationFrame(function () {
        // وثيقة قصيرة ما فيها تمرير = تُعتبر مقروءة
        if (atEnd(body)) st.read[st.doc] = true;
        updateProgress(); refreshControls();
      });
    }).catch(function () {
      if (!state || token !== state.token) return;
      body.innerHTML = '<div id="lgState">' + esc(L.loadError) + '<br><button type="button" id="lgRetry">' + esc(L.retry) + '</button></div>';
      var r = body.querySelector("#lgRetry");
      if (r) r.onclick = function () { showDoc(); };
    });
  }

  function mount() {
    ensureStyle();
    var o = document.createElement("div");
    o.id = "lgOverlay";
    o.setAttribute("data-no-i18n", "1");
    o.innerHTML =
      '<div id="lgBox" role="dialog" aria-modal="true" aria-labelledby="lgTitle" tabindex="-1">' +
        '<div id="lgHead">' +
          '<div id="lgTop"><h2 id="lgTitle"></h2><button type="button" id="lgLang"></button></div>' +
          '<p id="lgIntro"></p>' +
          '<div id="lgTabs"><button type="button" class="lg-tab" data-d="terms"></button><button type="button" class="lg-tab" data-d="privacy"></button></div>' +
          '<div id="lgBar"><div id="lgBarFill"></div></div>' +
          '<div id="lgMeta"><span id="lgMetaLbl"></span><span id="lgPct">0%</span></div>' +
        '</div>' +
        '<div id="lgBody"></div>' +
        '<div id="lgFoot">' +
          '<div id="lgHint"></div>' +
          '<label id="lgAgree" class="locked"><input type="checkbox" id="lgAgreeBox" disabled><span id="lgAgreeText"></span></label>' +
          '<div id="lgErr" role="alert"></div>' +
          '<div id="lgBtns"><button type="button" id="lgDecline"></button><button type="button" id="lgNext"></button><button type="button" id="lgAccept" disabled></button></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(o);
    state.prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    o.querySelector("#lgBody").addEventListener("scroll", updateProgress, { passive: true });
    o.querySelectorAll(".lg-tab").forEach(function (t) {
      t.onclick = function () { state.doc = t.dataset.d; render(); };
    });
    o.querySelector("#lgNext").onclick = function () { state.doc = "privacy"; render(); };
    o.querySelector("#lgLang").onclick = function () {
      var l = state.lang === "en" ? "ar" : "en";
      state.lang = l;
      try { if (window.MenuI18n && window.MenuI18n.setLang) window.MenuI18n.setLang(l); else localStorage.setItem("menu_lang", l); } catch (e) {}
      render();
    };
    o.querySelector("#lgAgreeBox").onchange = refreshControls;
    o.querySelector("#lgDecline").onclick = function () {
      var cb = state.onDecline; close(); if (cb) cb();
    };
    o.querySelector("#lgAccept").onclick = function () {
      var st = state;
      if (!allRead() || !o.querySelector("#lgAgreeBox").checked || st.busy) return;
      st.busy = true; refreshControls();
      var L = S[st.lang], err = o.querySelector("#lgErr");
      err.textContent = L.saving; err.style.color = "#6b7280";
      Promise.resolve().then(function () { return st.onAccept ? st.onAccept() : true; }).then(function (res) {
        if (res === false) throw new Error("REJECTED");
        close();
      }).catch(function () {
        if (!state) return;
        state.busy = false;
        err.style.color = "#DC2626"; err.textContent = S[state.lang].saveError;
        refreshControls();
      });
    };
    // لا إغلاق بـ Escape ولا بالنقر خارج الصندوق (موافقة إلزامية)
    o.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); } });
    o.querySelector("#lgBox").focus();
  }

  window.LegalGate = {
    require: function (opts) {
      opts = opts || {};
      if (document.getElementById("lgOverlay")) close();
      state = {
        mode: opts.mode === "update" ? "update" : "register",
        lang: curLang(), doc: "terms", read: {}, token: 0, loaded: false, busy: false,
        supportPhone: opts.supportPhone || "", onAccept: opts.onAccept, onDecline: opts.onDecline
      };
      mount();
      render();
    },
    close: close,
    _state: function () { return state; }
  };
})();
