import { supabase } from "./supabase.js";

const TZ_OFFSET_MS = 3 * 3600 * 1000;   // Asia/Bahrain (UTC+3, no DST)
const MAX_VALID_MIN = 360;               // discard durations above 6h (forgotten orders)
const DAY = 86400000;

let mode = "day";
let targets = { pMin: 15, pMax: 20, dMin: 30, dMax: 35 };
let rows = [];
let hasReadyAt = true;
let hasTargets = true;

const $ = (id) => document.getElementById(id);

function tsMs(iso) {
  if (!iso) return NaN;
  let s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s) && !/(Z|[+-]\d{2}(:?\d{2})?)$/i.test(s)) s = s.replace(" ", "T") + "Z";
  return new Date(s).getTime();
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// start of local (Bahrain) day for a given epoch ms
function dayStart(ms) { return Math.floor((ms + TZ_OFFSET_MS) / DAY) * DAY - TZ_OFFSET_MS; }
// week starts on Saturday (Gulf week)
function weekStart(ms) {
  const ds = dayStart(ms);
  const dow = new Date(ds + TZ_OFFSET_MS).getUTCDay(); // 0=Sun..6=Sat
  const back = (dow + 1) % 7;                           // Sat->0, Sun->1, ... Fri->6
  return ds - back * DAY;
}

function ranges(now) {
  if (mode === "day") {
    const t = dayStart(now);
    return { cur: [t, t + DAY], prev: [t - DAY, t], curLabel: "اليوم", prevLabel: "أمس" };
  }
  const w = weekStart(now);
  return { cur: [w, w + 7 * DAY], prev: [w - 7 * DAY, w], curLabel: "هذا الأسبوع", prevLabel: "الأسبوع الماضي" };
}

function enrich(r) {
  const start = tsMs(r.timer_started_at) || tsMs(r.created_at);
  const created = tsMs(r.created_at);
  const s = Number.isFinite(start) ? start : created;
  const ready = tsMs(r.ready_at), deliv = tsMs(r.delivered_at), closed = tsMs(r.closed_at);
  const mins = (a, b) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    const m = (b - a) / 60000;
    return m >= 0 && m <= MAX_VALID_MIN ? m : -1; // -1 = invalid (excluded)
  };
  const o = { r, key: created, start: s };
  o.prep = mins(s, ready);                                        // all orders with ready_at
  o.deliv = r.is_delivery ? mins(s, deliv) : null;                // delivered orders
  o.leg = r.is_delivery ? mins(ready, deliv) : null;              // ready -> delivered (driver leg)
  o.pick = !r.is_delivery && r.status !== "active" && r.status !== "pending" ? mins(s, closed) : null; // pickup completion
  return o;
}

const valid = (v) => v !== null && v >= 0;
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmt = (m) => (m == null ? "—" : m < 60 ? `${Math.round(m)} د` : `${Math.floor(m / 60)}س ${Math.round(m % 60)}د`);
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

function stats(list) {
  const prep = list.map((o) => o.prep).filter(valid);
  const deliv = list.map((o) => o.deliv).filter(valid);
  const leg = list.map((o) => o.leg).filter(valid);
  const pick = list.map((o) => o.pick).filter(valid);
  const excluded = list.filter((o) => o.prep === -1 || o.deliv === -1 || o.leg === -1 || o.pick === -1).length;
  const revenue = list.reduce((s, o) => s + (Number(o.r.total) || 0), 0);
  return {
    count: list.length,
    delivCount: list.filter((o) => o.r.is_delivery).length,
    revenue,
    prep, deliv, leg, pick, excluded,
    prepAvg: avg(prep), prepMed: med(prep), prepOk: pct(prep.filter((m) => m <= targets.pMax).length, prep.length),
    delAvg: avg(deliv), delMed: med(deliv), delOk: pct(deliv.filter((m) => m <= targets.dMax).length, deliv.length),
    legAvg: avg(leg), pickAvg: avg(pick),
  };
}

function inRange(list, [a, b]) { return list.filter((o) => o.key >= a && o.key < b); }

function delta(cur, prev, lowerBetter, unit) {
  if (cur == null || prev == null) return `<div class="d neu">— لا توجد مقارنة</div>`;
  const diff = cur - prev;
  if (Math.abs(diff) < (unit === "%" ? 1 : unit === "bd" ? 0.001 : 0.5)) return `<div class="d neu">= نفس الفترة السابقة</div>`;
  const better = lowerBetter ? diff < 0 : diff > 0;
  const arrow = diff > 0 ? "▲" : "▼";
  const txt = unit === "%" ? `${Math.abs(Math.round(diff))}%` : unit === "n" ? `${Math.abs(Math.round(diff))}` : unit === "bd" ? `${Math.abs(diff).toFixed(3)} د.ب` : fmt(Math.abs(diff));
  return `<div class="d ${better ? "good" : "bad"}">${arrow} ${txt} ${better ? "أفضل" : "أسوأ"}</div>`;
}

function kpi(label, val, sub, d) {
  return `<div class="kpi"><div class="l">${label}</div><div class="v">${val}</div><div class="s">${sub}</div>${d}</div>`;
}

function render() {
  const now = Date.now();
  const rg = ranges(now);
  const all = rows.map(enrich);
  const cur = stats(inRange(all, rg.cur));
  const prev = stats(inRange(all, rg.prev));

  $("kpiTitle").textContent = `الملخص — ${rg.curLabel} مقابل ${rg.prevLabel}`;
  const hp = `هدف ${targets.pMin}–${targets.pMax} د`;
  const hd = `هدف ${targets.dMin}–${targets.dMax} د`;
  const okSub = (p, n) => (p == null ? "لا توجد بيانات" : `${p}% ضمن الهدف · ${n} طلب`);
  const html = [
    kpi("📦 عدد الطلبات", cur.count, `${rg.prevLabel}: ${prev.count} · توصيل ${cur.delivCount}`, delta(cur.count, prev.count, false, "n")),
    kpi("💰 المبيعات", cur.revenue.toFixed(3), `${rg.prevLabel}: ${prev.revenue.toFixed(3)} د.ب`, delta(cur.revenue, prev.revenue, false, "bd")),
    kpi("👨‍🍳 متوسط التحضير", fmt(cur.prepAvg), `${hp} · ${okSub(cur.prepOk, cur.prep.length)}`, delta(cur.prepAvg, prev.prepAvg, true)),
    kpi("👨‍🍳 وسيط التحضير", fmt(cur.prepMed), `${rg.prevLabel}: ${fmt(prev.prepMed)}`, delta(cur.prepMed, prev.prepMed, true)),
    kpi("🎯 التحضير ضمن الهدف", cur.prepOk == null ? "—" : cur.prepOk + "%", `${rg.prevLabel}: ${prev.prepOk == null ? "—" : prev.prepOk + "%"}`, delta(cur.prepOk, prev.prepOk, false, "%")),
    kpi("🛵 متوسط التوصيل الكلي", fmt(cur.delAvg), `${hd} · ${okSub(cur.delOk, cur.deliv.length)}`, delta(cur.delAvg, prev.delAvg, true)),
    kpi("🛵 وسيط التوصيل", fmt(cur.delMed), `${rg.prevLabel}: ${fmt(prev.delMed)}`, delta(cur.delMed, prev.delMed, true)),
    kpi("🎯 التوصيل ضمن الهدف", cur.delOk == null ? "—" : cur.delOk + "%", `${rg.prevLabel}: ${prev.delOk == null ? "—" : prev.delOk + "%"}`, delta(cur.delOk, prev.delOk, false, "%")),
    kpi("📍 مشوار السائق (جاهز ← وصل)", fmt(cur.legAvg), `${rg.prevLabel}: ${fmt(prev.legAvg)}`, delta(cur.legAvg, prev.legAvg, true)),
    kpi("🏪 إنجاز طلبات الاستلام", fmt(cur.pickAvg), `من البداية للإغلاق · ${rg.prevLabel}: ${fmt(prev.pickAvg)}`, delta(cur.pickAvg, prev.pickAvg, true)),
  ];
  $("kpis").innerHTML = html.join("");

  const notes = [];
  if (!hasReadyAt) notes.push("⚠️ عمود وقت الجاهزية غير موجود — شغّل SQL المرحلة 14 عشان تظهر أوقات التحضير.");
  if (hasReadyAt && !cur.prep.length && !prev.prep.length) notes.push("أوقات التحضير تبدأ تتسجل من أول طلب تضغط له «جاهز» بعد التحديث.");
  const exc = cur.excluded + prev.excluded;
  if (exc) notes.push(`تم استبعاد ${exc} طلب بأوقات غير منطقية (سالبة أو أكثر من 6 ساعات).`);
  notes.push(mode === "day" ? "اليوم الحالي ما اكتمل، فالأعداد والمبيعات للمقارنة تقريبية؛ المتوسطات أدق." : "الأسبوع يبدأ من السبت، والأسبوع الحالي ما اكتمل فالأعداد للمقارنة تقريبية؛ المتوسطات أدق.");
  notes.push("الأيام بتوقيت البحرين من 12:00 منتصف الليل.");
  $("kpiNote").innerHTML = notes.join("<br>");

  // hourly prep (current period)
  const curList = inRange(all, rg.cur).filter((o) => valid(o.prep));
  const byH = {};
  curList.forEach((o) => { const h = new Date(o.key + TZ_OFFSET_MS).getUTCHours(); (byH[h] ||= []).push(o.prep); });
  const hrs = Object.keys(byH).map(Number).sort((a, b) => a - b);
  const maxV = Math.max(targets.pMax * 1.5, ...hrs.map((h) => avg(byH[h]) || 0), 1);
  $("hourly").innerHTML = hrs.length
    ? hrs.map((h) => {
        const a = avg(byH[h]);
        const col = a <= targets.pMin ? "#16A34A" : a <= targets.pMax ? "#2563EB" : "#DC2626";
        return `<div class="bar-row"><span class="h">${String(h).padStart(2, "0")}:00</span><span class="b"><i style="width:${Math.min(100, (a / maxV) * 100)}%;background:${col}"></i></span><span class="n">${fmt(a)} · ${byH[h].length} طلب</span></div>`;
      }).join("")
    : `<div class="note">لا توجد بيانات تحضير في هذه الفترة.</div>`;

  // slowest
  const slowList = inRange(all, rg.cur).filter((o) => valid(o.deliv) || valid(o.prep));
  slowList.sort((a, b) => (Math.max(b.deliv ?? 0, b.prep ?? 0)) - (Math.max(a.deliv ?? 0, a.prep ?? 0)));
  const pill = (m, min, max) => (!valid(m) ? "—" : `<span class="pill ${m <= min ? "p-fast" : m <= max ? "p-ok" : "p-late"}">${fmt(m)}</span>`);
  $("slow").innerHTML = slowList.length
    ? `<tr><th>الطلب</th><th>الوقت</th><th>النوع</th><th>التحضير</th><th>التوصيل الكلي</th></tr>` +
      slowList.slice(0, 10).map((o) => {
        const t = new Date(o.key + TZ_OFFSET_MS);
        const hh = String(t.getUTCHours()).padStart(2, "0") + ":" + String(t.getUTCMinutes()).padStart(2, "0");
        return `<tr><td>${esc(o.r.customer_name || "#" + String(o.r.id).slice(-4))}</td><td>${hh}</td><td>${o.r.is_delivery ? "🛵 توصيل" : "🏪 استلام"}</td><td>${pill(o.prep, targets.pMin, targets.pMax)}</td><td>${o.r.is_delivery ? pill(o.deliv, targets.dMin, targets.dMax) : "—"}</td></tr>`;
      }).join("")
    : `<tr><td class="note">لا توجد طلبات مكتملة في هذه الفترة.</td></tr>`;
}

async function loadTargets() {
  const { data, error } = await supabase.from("restaurant_settings")
    .select("prep_target_min,prep_target_max,delivery_target_min,delivery_target_max").eq("id", 1).maybeSingle();
  if (error) { hasTargets = false; return; }
  if (data) targets = { pMin: data.prep_target_min, pMax: data.prep_target_max, dMin: data.delivery_target_min, dMax: data.delivery_target_max };
}

function fillTargets() {
  $("pMin").value = targets.pMin; $("pMax").value = targets.pMax;
  $("dMin").value = targets.dMin; $("dMax").value = targets.dMax;
}

async function loadOrders() {
  const since = new Date(weekStart(Date.now()) - 7 * DAY - DAY).toISOString(); // covers last week + yesterday
  const base = "id,created_at,timer_started_at,delivered_at,closed_at,is_delivery,status,total,customer_name";
  let res = await supabase.from("orders").select(base + ",ready_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
  if (res.error && /ready_at/i.test(res.error.message || "")) {
    hasReadyAt = false;
    res = await supabase.from("orders").select(base).gte("created_at", since).order("created_at", { ascending: false }).limit(5000);
  }
  if (res.error) throw res.error;
  rows = res.data || [];
}

async function saveTargets() {
  const v = ["pMin", "pMax", "dMin", "dMax"].map((id) => parseInt($(id).value, 10));
  const msg = $("tgtMsg");
  if (v.some((x) => !Number.isInteger(x) || x < 1 || x > 240)) { msg.textContent = "❌ كل القيم لازم تكون أرقام من 1 إلى 240."; return; }
  if (v[0] > v[1] || v[2] > v[3]) { msg.textContent = "❌ «من» لازم يكون أقل من أو يساوي «إلى»."; return; }
  const { error } = await supabase.from("restaurant_settings").update({
    prep_target_min: v[0], prep_target_max: v[1], delivery_target_min: v[2], delivery_target_max: v[3],
  }).eq("id", 1);
  if (error) { msg.textContent = /prep_target|column/i.test(error.message || "") ? "❌ شغّل SQL المرحلة 14 أول." : "❌ فشل الحفظ: " + error.message; return; }
  targets = { pMin: v[0], pMax: v[1], dMin: v[2], dMax: v[3] };
  msg.textContent = "✅ تم حفظ الأهداف";
  render();
}

document.querySelectorAll(".tab").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b));
  mode = b.dataset.mode; render();
}));
$("saveTargets").addEventListener("click", saveTargets);

(async () => {
  try {
    await loadTargets();
    fillTargets();
    if (!hasTargets) { $("warn").style.display = "block"; $("warn").textContent = "⚠️ ما قدرت أقرأ الأهداف — شغّل SQL المرحلة 14. أستخدم القيم الافتراضية (تحضير 15–20 · توصيل 30–35)."; }
    await loadOrders();
    render();
  } catch (e) {
    $("warn").style.display = "block";
    $("warn").textContent = "❌ فشل تحميل الطلبات: " + (e.message || e);
  }
})();
