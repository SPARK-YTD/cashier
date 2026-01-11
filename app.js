import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

/*********************************
 * Get-Break | Cashier System
 *********************************/

let items = [];
let cart = [];
let activeOrders = [];
let editingOrderId = null;
let currentBusinessDay = null;

/* ========= LOAD CURRENT BUSINESS DAY ========= */
async function loadCurrentDay() {
  const { data } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  currentBusinessDay = data || null;

  const statusEl = document.getElementById("dayStatus");
  if (statusEl) {
    if (currentBusinessDay) {
      statusEl.textContent = "🟢 اليوم مفتوح";
      statusEl.style.color = "green";
    } else {
      statusEl.textContent = "🔴 اليوم مقفل";
      statusEl.style.color = "red";
    }
  }
}

/* ========= INIT ========= */
document.addEventListener("DOMContentLoaded", async () => {
  applyLang();
  await loadCurrentDay();

  if (!currentBusinessDay) return;

  await loadItems("food");
  await loadActiveOrders();
  renderCart();

  const paid = document.getElementById("paid");
  if (paid) paid.addEventListener("input", calculateChange);
});

/* ========= CATEGORIES ========= */
window.filterCategory = function (category, btn) {
  if (!currentBusinessDay) return;
  document.querySelectorAll(".cat").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  loadItems(category);
};

/* ========= ITEMS ========= */
async function loadItems(category) {
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("category", category)
    .eq("active", true);

  items = data || [];
  renderItems();
}

function renderItems() {
  const container = document.getElementById("items");
  if (!container) return;
  container.innerHTML = "";

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      ${item.image_url ? `<img src="${item.image_url}" class="cashier-item-img">` : ""}
      <strong>${item.name}</strong>
      <span>${item.has_variants ? "اختر الحجم" : item.price.toFixed(3) + " د.ب"}</span>
    `;
    div.onclick = () => currentBusinessDay && handleItemClick(item);
    container.appendChild(div);
  });
}

/* ========= VARIANTS ========= */
async function handleItemClick(item) {
  if (!item.has_variants) return addToCart(item);

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", item.id)
    .eq("active", true);

  if (!variants?.length) return;
  showVariantPopup(item, variants);
}

function showVariantPopup(item, variants) {
  let overlay = document.querySelector(".variant-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "variant-overlay";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="variant-box">
      <h3>${item.name}</h3>
      ${variants.map(v => `
        <button onclick="selectVariant('${item.id}','${item.name}','${v.id}','${v.label}',${v.price})">
          ${v.label} — ${v.price.toFixed(3)} د.ب
        </button>
      `).join("")}
      <button onclick="closeVariantPopup()">إلغاء</button>
    </div>
  `;
}

window.selectVariant = function (productId, name, variantId, label, price) {
  addToCart({
    id: productId,
    name: `${name} (${label})`,
    price,
    variant_id: variantId
  });
  closeVariantPopup();
};

window.closeVariantPopup = () =>
  document.querySelector(".variant-overlay")?.remove();

/* ========= CART ========= */
function addToCart(item) {
  const key = item.variant_id ? `${item.id}-${item.variant_id}` : item.id;
  const found = cart.find(i => i.key === key);
  found ? found.qty++ : cart.push({ ...item, key, qty: 1 });
  renderCart();
}

function renderCart() {
  const tbody = document.getElementById("cart");
  if (!tbody) return;
  tbody.innerHTML = "";

  let total = 0;
  cart.forEach((item, i) => {
    const sum = item.qty * item.price;
    total += sum;
    tbody.innerHTML += `
      <tr>
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>${sum.toFixed(3)} د.ب</td>
        <td><button onclick="removeItem(${i})">🗑</button></td>
      </tr>
    `;
  });

  document.getElementById("total").textContent = total.toFixed(3) + " د.ب";
  calculateChange();
}

window.removeItem = i => {
  cart.splice(i, 1);
  renderCart();
};

/* ========= PAYMENT ========= */
function calculateChange() {
  const paid = parseFloat(document.getElementById("paid").value) || 0;
  const total = parseFloat(document.getElementById("total").textContent) || 0;
  document.getElementById("change").textContent =
    paid >= total && paid ? (paid - total).toFixed(3) + " د.ب" : "—";
}

/* ========= COMPLETE ORDER ========= */
window.completeOrder = async function () {
  if (!currentBusinessDay) return;
  if (!cart.length) return;

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  if (editingOrderId) {
    await supabase.from("orders").update({ total }).eq("id", editingOrderId);
    await supabase.from("order_items").delete().eq("order_id", editingOrderId);
    await supabase.from("order_items").insert(
      cart.map(i => ({
        order_id: editingOrderId,
        product_id: i.id,
        qty: i.qty,
        price: i.price
      }))
    );
    editingOrderId = null;
  } else {
    const { data: order } = await supabase
      .from("orders")
      .insert({
        total,
        status: "active",
        business_day_id: currentBusinessDay.id
      })
      .select("id")
      .single();

    await supabase.from("order_items").insert(
      cart.map(i => ({
        order_id: order.id,
        product_id: i.id,
        qty: i.qty,
        price: i.price
      }))
    );
  }

  cart = [];
  renderCart();
  loadActiveOrders();
};

/* ========= ACTIVE ORDERS ========= */
async function loadActiveOrders() {
  if (!currentBusinessDay) return;

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "active")
    .eq("business_day_id", currentBusinessDay.id)
    .order("created_at", { ascending: false });

  activeOrders = data || [];
  renderActiveOrders();
}

function renderActiveOrders() {
  const box = document.getElementById("activeOrders");
  if (!box) return;
  box.innerHTML = "";

  activeOrders.forEach(order => {
    const div = document.createElement("div");
    div.className = "order-box";
    div.innerHTML = `
      <strong>فاتورة #${order.invoice_no}</strong><br>
      ${order.total.toFixed(3)} د.ب
    `;
    box.appendChild(div);
  });
}

/* ========= NAV ========= */
window.goToReports  = () => window.location.href = "report.html";
window.goToSettings = () => window.location.href = "settings.html";