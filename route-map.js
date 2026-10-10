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
