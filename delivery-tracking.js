import { supabase } from "./supabase.js";
window.supabase = supabase;

/*********************************
 * تتبع السائقين | Get-Break Cashier
 * يعرض:
 *   1) آخر موقع معروف لكل سائق نشط (delivery_accounts.current_lat/lng)
 *   2) مواقع طلبات التوصيل المعتمدة اللي لسا ما اتوصلت (orders.delivery_lat/lng)
 *   3) خط + وقت وصول تقديري بين السائق والطلب - فقط للطلبات اللي سائق "استلمها"
 *      (orders.assigned_driver_id) - الوقت تقديري بالمسافة المستقيمة + هامش طريق،
 *      مو توجيه فعلي (ما فيه خرائط بمفتاح API بهذا المشروع)
 *********************************/

const BAHRAIN_CENTER = [26.0667, 50.5577];
const ASSUMED_SPEED_KMH = 30;   // متوسط افتراضي (يُستخدم بس لو ما فيه بيانات حركة حقيقية كافية)
const ROAD_FACTOR = 1.35;       // هامش لأن الخط مستقيم مو الطريق الفعلي
const MIN_REALISTIC_SPEED_KMH = 4;   // أقل من كذا = السائق واقف (ما نحسبها سرعة حقيقية)
const MAX_REALISTIC_SPEED_KMH = 90;  // أكثر من كذا = قفزة GPS غلط، نتجاهلها

let map;
let driverMarkers = {};    // account_id -> L.Marker
let orderMarkers = {};     // order_id -> L.Marker
let assignmentLines = {};  // order_id -> L.Polyline
let etaLabels = {};        // order_id -> L.Marker (تسمية الوقت التقديري فوق الخط)
let latestDrivers = [];
let latestOrders = [];
let pollTimer;
let didInitialFit = false;

// ✅ نتتبع آخر موقع+وقت لكل سائق عشان نحسب سرعته الفعلية من حركته الحقيقية
// (بدل ما نفترض دايماً 30 كم/س) - يعطي وقت وصول تقديري أدق بدون أي خدمة توجيه خارجية
let driverLastFix = {}; // account_id -> { lat, lng, at }
let driverEstimatedSpeed = {}; // account_id -> km/h

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "login.html";
    return;
  }

  initMap();
  await refreshAll();
  pollTimer = setInterval(refreshAll, 10000);
});

function initMap() {
  map = L.map("map").setView(BAHRAIN_CENTER, 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);
}

async function refreshAll() {
  const [drivers, orders, recentDeliveries] = await Promise.all([
    loadDrivers(),
    loadPendingDeliveryOrders(),
    loadRecentDeliveries()
  ]);
  updateDriverSpeeds(drivers);
  latestDrivers = drivers;
  latestOrders = orders;
  renderDrivers(drivers);
  renderOrders(orders, drivers);
  renderRecentDeliveries(recentDeliveries);
  fitMapToEverythingOnce(drivers, orders);
}

// ✅ آخر التسليمات المكتملة بآخر ساعة - لعرض الوقت الفعلي اللي أخذه التوصيل
async function loadRecentDeliveries() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("orders")
    .select("id, invoice_no, customer_name, assigned_driver_id, created_at, delivered_at")
    .eq("is_delivery", true)
    .eq("is_delivered", true)
    .gte("delivered_at", oneHourAgo)
    .order("delivered_at", { ascending: false });

  if (error) {
    console.error("❌ LOAD RECENT DELIVERIES ERROR:", error);
    return [];
  }
  return data || [];
}

function renderRecentDeliveries(recentDeliveries) {
  const listBox = document.getElementById("recentDeliveriesList");
  if (!listBox) return;

  if (!recentDeliveries || recentDeliveries.length === 0) {
    listBox.innerHTML = `<div class="empty-sidebar">لا يوجد تسليمات بآخر ساعة</div>`;
    return;
  }

  const driversById = {};
  latestDrivers.forEach(d => { driversById[d.id] = d; });

  listBox.innerHTML = recentDeliveries.map(o => {
    const driver = o.assigned_driver_id ? driversById[o.assigned_driver_id] : null;
    let durationLabel = "—";
    if (o.created_at && o.delivered_at) {
      const mins = Math.round((new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime()) / 60000);
      durationLabel = mins >= 60 ? `${Math.floor(mins / 60)} س ${mins % 60} د` : `${mins} د`;
    }
    return `
      <div class="recent-row">
        <div class="invoice">🧾 #${o.invoice_no ?? "—"} - ${escapeHtml(o.customer_name || "عميل")}</div>
        <div>${driver ? "🚚 " + escapeHtml(driver.name) : "—"} · <span class="duration">${durationLabel}</span></div>
      </div>
    `;
  }).join("");
}

// ✅ يضبط زوم/حدود الخريطة تلقائياً على كل السائقين والطلبات - مرة واحدة فقط
// عند أول تحميل، عشان ما يفتح على خريطة فاضية ولا يفاجئ المستخدم بالزوم يتغير
// من نفسه بعدين وهو شغال على الخريطة
function fitMapToEverythingOnce(drivers, orders) {
  if (didInitialFit) return;

  const points = [];
  drivers.forEach(d => {
    if (d.current_lat != null && d.current_lng != null) points.push([d.current_lat, d.current_lng]);
  });
  orders.forEach(o => {
    if (o.delivery_lat != null && o.delivery_lng != null) points.push([o.delivery_lat, o.delivery_lng]);
  });

  if (points.length === 0) return; // ما فيه بيانات كافية بعد - نحاول بالتحديث الجاي

  didInitialFit = true;
  if (points.length === 1) {
    map.setView(points[0], 14);
  } else {
    map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 15 });
  }
}

// ✅ يحسب سرعة كل سائق من الفرق بين موقعه الحالي وموقعه بالتحديث السابق
// (مسافة ÷ وقت) - سرعة حقيقية مبنية على حركته الفعلية، مو رقم ثابت مفترض
function updateDriverSpeeds(drivers) {
  drivers.forEach(d => {
    if (d.current_lat == null || d.current_lng == null || !d.location_updated_at) return;

    const now = new Date(d.location_updated_at).getTime();
    const prev = driverLastFix[d.id];

    if (prev && prev.at !== now) {
      const distKm = haversineKm(prev.lat, prev.lng, d.current_lat, d.current_lng);
      const hours = (now - prev.at) / 3600000;
      if (hours > 0) {
        const speed = distKm / hours;
        if (speed >= MIN_REALISTIC_SPEED_KMH && speed <= MAX_REALISTIC_SPEED_KMH) {
          // ✅ متوسط متحرك بسيط (70% القديم + 30% الجديد) عشان ما تتقلب الأرقام بعنف
          const prevSpeed = driverEstimatedSpeed[d.id] || speed;
          driverEstimatedSpeed[d.id] = prevSpeed * 0.7 + speed * 0.3;
        }
      }
    }

    driverLastFix[d.id] = { lat: d.current_lat, lng: d.current_lng, at: now };
  });
}

async function loadDrivers() {
  const { data, error } = await supabase
    .from("delivery_accounts")
    .select("id, name, username, active, current_lat, current_lng, location_updated_at")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("❌ LOAD DRIVERS ERROR:", error);
    return [];
  }
  return data || [];
}

async function loadPendingDeliveryOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, invoice_no, customer_name, customer_phone, delivery_fee,
      delivery_lat, delivery_lng, delivery_block, delivery_road, delivery_building,
      assigned_driver_id, created_at, timer_started_at
    `)
    .eq("is_delivery", true)
    .eq("customer_order_confirmed", true)
    .eq("is_delivered", false)
    .in("status", ["pending", "active"])
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ LOAD ORDERS ERROR:", error);
    return [];
  }
  return data || [];
}

/* ===============================
   حسابات المسافة/الوقت التقديري
================================ */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ✅ لو عندنا سرعة حقيقية محسوبة من حركة السائق الفعلية نستخدمها، وإلا نرجع للافتراضي
function estimateEtaMinutes(distanceKm, driverId) {
  const realSpeed = driverId ? driverEstimatedSpeed[driverId] : null;
  const speed = realSpeed && realSpeed > 0 ? realSpeed : ASSUMED_SPEED_KMH;
  const hours = (distanceKm * ROAD_FACTOR) / speed;
  return Math.max(1, Math.round(hours * 60));
}

function freshnessState(updatedAt) {
  if (!updatedAt) return "offline";
  const ageSec = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  if (ageSec < 120) return "live";
  if (ageSec < 600) return "stale";
  return "offline";
}

function timeAgoLabel(updatedAt) {
  if (!updatedAt) return "ما شارك موقعه بعد";
  const sec = Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000);
  if (sec < 60) return "الآن";
  const min = Math.floor(sec / 60);
  if (min < 60) return `منذ ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  return `منذ ${hr} ساعة`;
}

/* ===============================
   عرض السائقين
================================ */
function renderDrivers(drivers) {
  const listBox = document.getElementById("driversList");
  const countEl = document.getElementById("driverCount");
  const withLocation = drivers.filter(d => d.current_lat != null && d.current_lng != null);
  countEl.textContent = drivers.length;

  if (drivers.length === 0) {
    listBox.innerHTML = `<div class="empty-sidebar">لا يوجد حسابات ديلفري نشطة</div>`;
    clearMarkers(driverMarkers);
    return;
  }

  listBox.innerHTML = drivers.map(d => {
    const state = freshnessState(d.location_updated_at);
    const hasLoc = d.current_lat != null && d.current_lng != null;
    return `
      <div class="driver-row" onclick="focusDriver('${d.id}')">
        <div class="name"><span class="dot ${state}"></span>${escapeHtml(d.name)}</div>
        <div class="meta">${hasLoc ? timeAgoLabel(d.location_updated_at) : "ما شارك موقعه بعد"}</div>
      </div>
    `;
  }).join("");

  const seenIds = new Set();
  withLocation.forEach(d => {
    seenIds.add(d.id);
    const state = freshnessState(d.location_updated_at);
    const color = state === "live" ? "#16A34A" : state === "stale" ? "#F59E0B" : "#94A3B8";

    const icon = L.divIcon({
      className: "",
      html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4);"></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    if (driverMarkers[d.id]) {
      driverMarkers[d.id].setLatLng([d.current_lat, d.current_lng]);
      driverMarkers[d.id].setIcon(icon);
    } else {
      driverMarkers[d.id] = L.marker([d.current_lat, d.current_lng], { icon }).addTo(map);
    }
    driverMarkers[d.id].bindPopup(`<strong>🚚 ${escapeHtml(d.name)}</strong><br>${timeAgoLabel(d.location_updated_at)}`);
  });

  Object.keys(driverMarkers).forEach(id => {
    if (!seenIds.has(id)) {
      map.removeLayer(driverMarkers[id]);
      delete driverMarkers[id];
    }
  });
}

/* ===============================
   عرض طلبات التوصيل + الخط + الوقت التقديري
================================ */
function renderOrders(orders, drivers) {
  const listBox = document.getElementById("ordersList");
  const countEl = document.getElementById("ordersCount");
  countEl.textContent = orders.length;

  const driversById = {};
  drivers.forEach(d => { driversById[d.id] = d; });

  if (orders.length === 0) {
    listBox.innerHTML = `<div class="empty-sidebar">لا يوجد طلبات توصيل بالطريق حالياً</div>`;
    clearMarkers(orderMarkers);
    clearLines();
    clearMarkers(etaLabels);
    return;
  }

  listBox.innerHTML = orders.map(o => {
    const addressParts = [
      o.delivery_block ? `مجمع ${o.delivery_block}` : null,
      o.delivery_road ? `طريق ${o.delivery_road}` : null,
      o.delivery_building ? `مبنى ${o.delivery_building}` : null
    ].filter(Boolean).join(" - ");

    const driver = o.assigned_driver_id ? driversById[o.assigned_driver_id] : null;
    const hasCustomerLoc = o.delivery_lat != null && o.delivery_lng != null;
    const hasDriverLoc = driver && driver.current_lat != null && driver.current_lng != null;

    let etaHtml = `<span class="unassigned-pill">⚠️ ما استلمها أحد بعد</span>`;
    if (driver) {
      if (hasCustomerLoc && hasDriverLoc) {
        const dist = haversineKm(driver.current_lat, driver.current_lng, o.delivery_lat, o.delivery_lng);
        const eta = estimateEtaMinutes(dist, driver.id);
        etaHtml = `<span class="eta-pill">🚴 ${escapeHtml(driver.name)} - وصول تقديري ~${eta} د</span>`;
      } else {
        etaHtml = `<span class="eta-pill">🚴 مستلمة: ${escapeHtml(driver.name)}</span>`;
      }
    }

    return `
      <div class="order-row" onclick="focusOrder('${o.id}')">
        <div class="invoice">🧾 #${o.invoice_no ?? "—"} - ${escapeHtml(o.customer_name || "عميل")}</div>
        <div class="meta">${addressParts ? escapeHtml(addressParts) : "بدون عنوان تفصيلي"}</div>
        <div>${etaHtml}</div>
      </div>
    `;
  }).join("");

  // ✅ ماركرز الزبائن
  const seenOrderIds = new Set();
  const customerIcon = L.divIcon({
    className: "",
    html: `<div style="background:#DC2626;color:white;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,0.4);"><span style="transform:rotate(45deg);font-size:11px;">📦</span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22]
  });

  orders.forEach(o => {
    if (o.delivery_lat == null || o.delivery_lng == null) return;
    seenOrderIds.add(o.id);

    if (orderMarkers[o.id]) {
      orderMarkers[o.id].setLatLng([o.delivery_lat, o.delivery_lng]);
    } else {
      orderMarkers[o.id] = L.marker([o.delivery_lat, o.delivery_lng], { icon: customerIcon }).addTo(map);
    }
    orderMarkers[o.id].bindPopup(`<strong>📦 فاتورة #${o.invoice_no ?? "—"}</strong><br>${escapeHtml(o.customer_name || "عميل")}`);
  });

  Object.keys(orderMarkers).forEach(id => {
    if (!seenOrderIds.has(id)) {
      map.removeLayer(orderMarkers[id]);
      delete orderMarkers[id];
    }
  });

  // ✅ خطوط الربط بين السائق المستلم والزبون + تسمية الوقت التقديري فوق منتصف الخط
  const seenLineIds = new Set();
  orders.forEach(o => {
    if (!o.assigned_driver_id) return;
    const driver = driversById[o.assigned_driver_id];
    if (!driver || driver.current_lat == null || driver.current_lng == null) return;
    if (o.delivery_lat == null || o.delivery_lng == null) return;

    seenLineIds.add(o.id);
    const pathCoords = [[driver.current_lat, driver.current_lng], [o.delivery_lat, o.delivery_lng]];

    if (assignmentLines[o.id]) {
      assignmentLines[o.id].setLatLngs(pathCoords);
    } else {
      assignmentLines[o.id] = L.polyline(pathCoords, {
        color: "#2563EB",
        weight: 2,
        dashArray: "6, 8",
        opacity: 0.8
      }).addTo(map);
    }

    // ✅ تسمية الوقت التقديري تتحدث بسرعة السائق الحقيقية لو محسوبة، وإلا الافتراضي
    const dist = haversineKm(driver.current_lat, driver.current_lng, o.delivery_lat, o.delivery_lng);
    const eta = estimateEtaMinutes(dist, driver.id);
    const midLat = (driver.current_lat + o.delivery_lat) / 2;
    const midLng = (driver.current_lng + o.delivery_lng) / 2;
    const labelIcon = L.divIcon({
      className: "",
      html: `<div class="eta-label">⏱ ~${eta} د</div>`,
      iconSize: null
    });

    if (etaLabels[o.id]) {
      etaLabels[o.id].setLatLng([midLat, midLng]);
      etaLabels[o.id].setIcon(labelIcon);
    } else {
      etaLabels[o.id] = L.marker([midLat, midLng], { icon: labelIcon, interactive: false }).addTo(map);
    }
  });

  Object.keys(assignmentLines).forEach(id => {
    if (!seenLineIds.has(id)) {
      map.removeLayer(assignmentLines[id]);
      delete assignmentLines[id];
    }
  });
  Object.keys(etaLabels).forEach(id => {
    if (!seenLineIds.has(id)) {
      map.removeLayer(etaLabels[id]);
      delete etaLabels[id];
    }
  });
}

function clearMarkers(store) {
  Object.values(store).forEach(m => map.removeLayer(m));
  Object.keys(store).forEach(k => delete store[k]);
}

function clearLines() {
  Object.values(assignmentLines).forEach(l => map.removeLayer(l));
  Object.keys(assignmentLines).forEach(k => delete assignmentLines[k]);
}

window.focusDriver = function (id) {
  const marker = driverMarkers[id];
  if (!marker) {
    alert("⚠️ ما فيه موقع محدث لهذا السائق");
    return;
  }
  map.setView(marker.getLatLng(), 16);
  marker.openPopup();
};

window.focusOrder = function (id) {
  const order = latestOrders.find(o => o.id === id);
  if (!order || order.delivery_lat == null) {
    alert("⚠️ ما فيه موقع مرسل لهذا الطلب");
    return;
  }

  const custMarker = orderMarkers[id];
  const driverMarker = order.assigned_driver_id ? driverMarkers[order.assigned_driver_id] : null;

  if (driverMarker) {
    const bounds = L.latLngBounds([custMarker.getLatLng(), driverMarker.getLatLng()]);
    map.fitBounds(bounds, { padding: [60, 60] });
  } else {
    map.setView(custMarker.getLatLng(), 16);
  }
  custMarker.openPopup();
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
