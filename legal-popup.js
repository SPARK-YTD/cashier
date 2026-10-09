// legal-popup.js — نافذة منبثقة لسياسة الخصوصية وشروط الاستخدام (تفتح في أي وقت)
// الاستخدام:  <script src="legal-popup.js" data-privacy="privacy.html" data-terms="terms.html" data-footer="flow|fixed|off"></script>
// ويمكن استدعاؤها من أي مكان:  openLegal('privacy')  أو  openLegal('terms')
(function () {
  var me = document.currentScript;
  var cfg = {
    privacy: (me && me.dataset.privacy) || "privacy.html",
    terms: (me && me.dataset.terms) || "terms.html",
    footer: (me && me.dataset.footer) || "flow"
  };
  var TITLES = { privacy: "سياسة الخصوصية", terms: "شروط الاستخدام" };

  var css = document.createElement("style");
  css.textContent =
    "#legalOverlay{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px;direction:rtl}" +
    "#legalBox{background:#fff;width:min(760px,100%);height:min(88vh,900px);border-radius:14px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5)}" +
    "#legalBar{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #e5e7eb;font:700 15px system-ui,Tahoma,sans-serif;color:#111827}" +
    "#legalBar button{border:0;background:#f3f4f6;color:#111827;border-radius:8px;padding:6px 12px;font:700 14px system-ui,Tahoma,sans-serif;cursor:pointer}" +
    "#legalTabs{display:flex;gap:6px}" +
    "#legalTabs button.on{background:#10b981;color:#fff}" +
    "#legalFrame{flex:1;width:100%;border:0;background:#fff}" +
    ".legal-footer{text-align:center;font:13px system-ui,Tahoma,sans-serif;color:#6b7280;padding:14px 10px;direction:rtl}" +
    ".legal-footer.fixed{position:fixed;left:0;right:0;bottom:0;z-index:50}" +
    ".legal-footer a{color:#2563eb;text-decoration:underline;cursor:pointer;margin:0 6px}";
  document.head.appendChild(css);

  function close() {
    var o = document.getElementById("legalOverlay");
    if (o) o.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(e) { if (e.key === "Escape") close(); }

  function open(kind) {
    if (!cfg[kind]) kind = "privacy";
    close();
    var o = document.createElement("div");
    o.id = "legalOverlay";
    o.innerHTML =
      '<div id="legalBox" role="dialog" aria-modal="true">' +
        '<div id="legalBar">' +
          '<div id="legalTabs">' +
            '<button type="button" data-k="terms">' + TITLES.terms + '</button>' +
            '<button type="button" data-k="privacy">' + TITLES.privacy + '</button>' +
          '</div>' +
          '<button type="button" id="legalClose" aria-label="إغلاق">✕ إغلاق</button>' +
        '</div>' +
        '<iframe id="legalFrame" title="legal"></iframe>' +
      '</div>';
    document.body.appendChild(o);
    function show(k) {
      o.querySelector("#legalFrame").src = cfg[k];
      [].forEach.call(o.querySelectorAll("#legalTabs button"), function (b) {
        b.classList.toggle("on", b.dataset.k === k);
      });
    }
    o.querySelector("#legalClose").onclick = close;
    o.addEventListener("click", function (e) { if (e.target === o) close(); });
    [].forEach.call(o.querySelectorAll("#legalTabs button"), function (b) {
      b.onclick = function () { show(b.dataset.k); };
    });
    document.addEventListener("keydown", onKey);
    show(kind);
  }
  window.openLegal = open;

  function addFooter() {
    if (cfg.footer === "off" || document.getElementById("legalFooter")) return;
    var f = document.createElement("div");
    f.id = "legalFooter";
    f.className = "legal-footer" + (cfg.footer === "fixed" ? " fixed" : "");
    f.innerHTML = '<a onclick="openLegal(\'terms\')">شروط الاستخدام</a> · <a onclick="openLegal(\'privacy\')">سياسة الخصوصية</a>';
    document.body.appendChild(f);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addFooter);
  else addFooter();
})();
