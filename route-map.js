/*********************************
 * route-map.js | Get-Break Cashier
 * وحدة مشتركة: مسار فعلي على الطرق بين نقطتين (سائق -> زبون)
 * المصدر: خدمة OSRM العامة المجانية (بدون مفتاح API).
 *
 * حماية من الاستهلاك الزايد:
 *   - طلب واحد بالثانية كحد أقصى (طابور)
 *   - كاش: نعيد المسار القديم إذا السائق ما تحرك أكثر من 120 متر وعمر المسار أقل من 60 ثانية
 *   - نفس المفتاح (طلب/سائق) ما ينطلب مرتين بنفس الوقت
 * إذا الخدمة وقفت أو تأخرت (8 ثواني): نرجع خط مستقيم تقريبي مع approx=true
 * عشان الخريطة ما تفضى أبداً.
 *********************************/

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const MIN_INTERVAL_MS = 1100;
const REUSE_MOVE_METERS = 120;
const REUSE_MAX_AGE_MS = 60000;
const FETCH_TIMEOUT_MS = 8000;
const FALLBACK_SPEED_KMH = 30;
const FALLBACK_ROAD_FACTOR = 1.35;

const cache = new Map();     // key -> { from, to, at, result }
const inflight = new Map();  // key -> Promise
let queue = Promise.resolve();
let lastCallAt = 0;

export function isValidPoint(p) {
  return !!p &&
    Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
    p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function metersBetween(a, b) {
  return haversineKm(a.lat, a.lng, b.lat, b.lng) * 1000;
}

// خط مستقيم + وقت تقريبي (بديل لما الخدمة ما ترد)
export function approxRoute(from, to, speedKmh) {
  const km = haversineKm(from.lat, from.lng, to.lat, to.lng) * FALLBACK_ROAD_FACTOR;
  const speed = speedKmh && speedKmh > 0 ? speedKmh : FALLBACK_SPEED_KMH;
  return {
    approx: true,
    coords: [[from.lat, from.lng], [to.lat, to.lng]],
    distanceKm: km,
    minutes: Math.max(1, Math.round((km / speed) * 60))
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function schedule(fn) {
  const run = queue.then(async () => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait) await sleep(wait);
    lastCallAt = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

async function fetchOsrm(from, to) {
  const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}` +
              `?overview=full&geometries=geojson&alternatives=false&steps=false`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    const r = json && json.code === "Ok" && json.routes && json.routes[0];
    const line = r && r.geometry && r.geometry.coordinates;
    if (!r || !Array.isArray(line) || line.length < 2) throw new Error("NO_ROUTE");
    const coords = line
      .filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
      .map(c => [c[1], c[0]]);               // GeoJSON = [lng,lat] -> Leaflet = [lat,lng]
    if (coords.length < 2) throw new Error("BAD_GEOMETRY");
    return {
      approx: false,
      coords,
      distanceKm: r.distance / 1000,
      minutes: Math.max(1, Math.round(r.duration / 60))
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * getRoute(key, from, to, speedKmh?)
 *   key   : معرّف ثابت للكاش (مثلاً order id)
 *   from/to: { lat, lng }
 * يرجع دايماً نتيجة صالحة: { approx, coords, distanceKm, minutes }
 */
export async function getRoute(key, from, to, speedKmh) {
  if (!isValidPoint(from) || !isValidPoint(to)) return null;

  const hit = cache.get(key);
  if (hit && metersBetween(hit.to, to) < 5 &&
      metersBetween(hit.from, from) < REUSE_MOVE_METERS &&
      Date.now() - hit.at < REUSE_MAX_AGE_MS) {
    return hit.result;
  }

  if (inflight.has(key)) return inflight.get(key);

  const p = schedule(() => fetchOsrm(from, to))
    .then(result => {
      cache.set(key, { from: { ...from }, to: { ...to }, at: Date.now(), result });
      return result;
    })
    .catch(() => {
      // نخزن البديل لمدة قصيرة (15 ثانية) عشان ما نضرب الخدمة وهي واقفة
      const result = approxRoute(from, to, speedKmh);
      cache.set(key, { from: { ...from }, to: { ...to }, at: Date.now() - (REUSE_MAX_AGE_MS - 15000), result });
      return result;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

export function clearRouteCache(key) {
  if (key === undefined) cache.clear(); else cache.delete(key);
}

export function formatDistance(km) {
  if (!Number.isFinite(km)) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}


/* ============================================================
 * مسارات بديلة + أدوات هندسية (لاختيار السائق لمساره)
 * ============================================================ */

async function fetchOsrmAlternatives(from, to) {
  const url = `${OSRM_BASE}/${from.lng},${from.lat};${to.lng},${to.lat}` +
              `?overview=full&geometries=geojson&alternatives=true&steps=false`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const json = await res.json();
    if (!json || json.code !== "Ok" || !Array.isArray(json.routes) || !json.routes.length) throw new Error("NO_ROUTE");
    const out = [];
    for (const r of json.routes.slice(0, 3)) {
      const line = r && r.geometry && r.geometry.coordinates;
      if (!Array.isArray(line) || line.length < 2) continue;
      const coords = line
        .filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1]))
        .map(c => [c[1], c[0]]);
      if (coords.length < 2) continue;
      out.push({
        approx: false,
        coords,
        distanceKm: r.distance / 1000,
        minutes: Math.max(1, Math.round(r.duration / 60))
      });
    }
    if (!out.length) throw new Error("BAD_GEOMETRY");
    return out;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * getRouteAlternatives(from, to)
 * يرجع دايماً مصفوفة (1 إلى 3) مرتبة من الأسرع. إذا الخدمة وقفت: عنصر واحد approx=true.
 * نفس الطابور (طلب/ثانية) فما نزيد الضغط على الخدمة.
 */
export async function getRouteAlternatives(from, to, speedKmh) {
  if (!isValidPoint(from) || !isValidPoint(to)) return [];
  try {
    const list = await schedule(() => fetchOsrmAlternatives(from, to));
    list.sort((a, b) => a.minutes - b.minutes || a.distanceKm - b.distanceKm);
    return list;
  } catch {
    return [approxRoute(from, to, speedKmh)];
  }
}

// تقليل عدد النقاط (للتخزين): Douglas-Peucker بتسامح يزيد تدريجياً لين نوصل للحد الأقصى،
// 5 خانات عشرية (~1 متر)، دايماً نحافظ على أول وآخر نقطة والشكل العام للمنعطفات
export function simplifyCoords(coords, maxPts = 300) {
  if (!Array.isArray(coords) || coords.length < 2) return [];
  const r5 = v => Math.round(v * 1e5) / 1e5;
  const kx = Math.cos(coords[0][0] * Math.PI / 180) * 111320, ky = 110540;
  const X = coords.map(c => c[1] * kx), Y = coords.map(c => c[0] * ky);

  function dp(tol) {
    const keep = new Uint8Array(coords.length);
    keep[0] = keep[coords.length - 1] = 1;
    const stack = [[0, coords.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      let maxD = 0, idx = -1;
      const dx = X[b] - X[a], dy = Y[b] - Y[a], len2 = dx * dx + dy * dy;
      for (let i = a + 1; i < b; i++) {
        let u = len2 > 0 ? ((X[i] - X[a]) * dx + (Y[i] - Y[a]) * dy) / len2 : 0;
        u = Math.max(0, Math.min(1, u));
        const px = X[a] + u * dx - X[i], py = Y[a] + u * dy - Y[i];
        const d = Math.sqrt(px * px + py * py);
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (idx > -1 && maxD > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
    }
    const out = [];
    for (let i = 0; i < coords.length; i++) if (keep[i]) out.push(coords[i]);
    return out;
  }

  let out = coords, tol = 1;
  for (let k = 0; k < 14 && out.length > maxPts; k++) { out = dp(tol); tol *= 2; }
  if (out.length > maxPts) {                    // احتياط: تقليل منتظم
    const step = (out.length - 1) / (maxPts - 1), u = [];
    for (let i = 0; i < maxPts; i++) u.push(out[Math.round(i * step)]);
    out = u;
  }
  return out.map(c => [r5(c[0]), r5(c[1])]);
}

// إسقاط نقطة على خط: نرجع أقرب مسافة (متر) ومكان القطعة والنقطة المسقطة
export function projectOnRoute(coords, pt) {
  if (!Array.isArray(coords) || coords.length < 2 || !isValidPoint(pt)) return null;
  const kx = Math.cos(pt.lat * Math.PI / 180) * 111320;   // متر لكل درجة طول
  const ky = 110540;                                       // متر لكل درجة عرض
  let best = null;
  for (let i = 0; i < coords.length - 1; i++) {
    const ax = (coords[i][1] - pt.lng) * kx, ay = (coords[i][0] - pt.lat) * ky;
    const bx = (coords[i + 1][1] - pt.lng) * kx, by = (coords[i + 1][0] - pt.lat) * ky;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let u = len2 > 0 ? (-(ax * dx + ay * dy)) / len2 : 0;
    u = Math.max(0, Math.min(1, u));
    const px = ax + u * dx, py = ay + u * dy;
    const d = Math.sqrt(px * px + py * py);
    if (!best || d < best.meters) {
      best = { meters: d, index: i, lat: pt.lat + py / ky, lng: pt.lng + px / kx };
    }
  }
  return best;
}

export function routeLengthKm(coords) {
  let km = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    km += haversineKm(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  return km;
}

/**
 * remainingRoute(coords, totalMinutes, pt)
 * الجزء المتبقي من المسار المحفوظ من موقع السائق الحالي + الوقت المتبقي بالنسبة والتناسب
 * يرجع { coords, remainingKm, minutes, offMeters }
 */
export function remainingRoute(coords, totalMinutes, pt) {
  const proj = projectOnRoute(coords, pt);
  if (!proj) return null;
  const rest = [[proj.lat, proj.lng], ...coords.slice(proj.index + 1)];
  const totalKm = routeLengthKm(coords);
  const remainingKm = routeLengthKm(rest);
  const ratio = totalKm > 0 ? Math.min(1, remainingKm / totalKm) : 1;
  const minutes = remainingKm < 0.05 ? 1 : Math.max(1, Math.round(totalMinutes * ratio));
  return { coords: rest, remainingKm, minutes, offMeters: proj.meters };
}
