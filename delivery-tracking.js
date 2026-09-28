import { supabase } from "./supabase.js";
window.supabase = supabase;

/*********************************
 * تتبع السائقين | Get-Break Cashier
 * يعرض آخر موقع معروف لكل حساب ديلفري نشط على خريطة (Leaflet + OpenStreetMap)
 * الموقع يترسل من delivery.js (صفحة السائق) كل ما يتحرك، بحد أقصى مرة كل 15 ثانية
 *********************************/

const BAHRAIN_CENTER = [26.0667, 50.5577];

let map;
let markers = {}; // account_id -> L.Marker
let pollTimer;

document.addEventListener("DOMContentLoaded", async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "login.html";
    return;
  }

  initMap();
  await loadDrivers();
  pollTimer = setInterval(loadDrivers, 10000);
});

function initMap() {
  map = L.map("map").setView(BAHRAIN_CENTER, 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
}

async function loadDrivers() {
  const { data, error } = await supabase
    .from("delivery_accounts")
    .select("id, name, username, active, current_lat, current_lng, location_updated_at")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("❌ LOAD DRIVERS ERROR:", error);
    return;
  }

  renderDrivers(data || []);
}

function freshnessState(updatedAt) {
  if (!updatedAt) return "offline";
  const ageSec = (Date.now() - new Date(updatedAt).getTime()) / 1000;
  if (ageSec < 120) return "live";       // أقل من دقيقتين
  if (ageSec < 600) return "stale";      // أقل من 10 دقايق
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

function renderDrivers(drivers) {
  const listBox = document.getElementById("driversList");
  const countEl = document.getElementById("driverCount");

  const withLocation = drivers.filter(d => d.current_lat != null && d.current_lng != null);
  countEl.textContent = drivers.length;

  if (drivers.length === 0) {
    listBox.innerHTML = `<div class="empty-sidebar">لا يوجد حسابات ديلفري نشطة</div>`;
    clearAllMarkers();
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

  // ✅ حدّث الماركرز على الخريطة
  const seenIds = new Set();

  withLocation.forEach(d => {
    seenIds.add(d.id);
    const state = freshnessState(d.location_updated_at);
    const color = state === "live" ? "#16A34A" : state === "stale" ? "#F59E0B" : "#94A3B8";

    const icon = L.divIcon({
      className: "",
      html: `<div style="
        background:${color};
        width:18px;height:18px;border-radius:50%;
        border:3px solid white;
        box-shadow:0 0 6px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });

    if (markers[d.id]) {
      markers[d.id].setLatLng([d.current_lat, d.current_lng]);
      markers[d.id].setIcon(icon);
    } else {
      markers[d.id] = L.marker([d.current_lat, d.current_lng], { icon }).addTo(map);
    }

    markers[d.id].bindPopup(`<strong>${escapeHtml(d.name)}</strong><br>${timeAgoLabel(d.location_updated_at)}`);
  });

  // ✅ شيل ماركرز أي حساب صار غير نشط أو انحذف
  Object.keys(markers).forEach(id => {
    if (!seenIds.has(id)) {
      map.removeLayer(markers[id]);
      delete markers[id];
    }
  });
}

function clearAllMarkers() {
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};
}

window.focusDriver = function (id) {
  const marker = markers[id];
  if (!marker) {
    alert("⚠️ ما فيه موقع محدث لهذا السائق");
    return;
  }
  map.setView(marker.getLatLng(), 16);
  marker.openPopup();
};

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
