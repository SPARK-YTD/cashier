import { supabase } from "./supabase.js";

let items = [];
let cart = [];
let activeOrders = [];
let editingOrderId = null;
let currentBusinessDay = null;

/* ======================
   تحميل اليوم الحالي
====================== */
async function loadCurrentDay() {
  const { data } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .order("opened_at", { ascending: false })
    .limit(1)
    .single();

  currentBusinessDay = data || null;
}

/* ======================
   INIT
====================== */
document.addEventListener("DOMContentLoaded", async () => {
  await loadCurrentDay();
  await loadItems("food");
  await loadActiveOrders();
  renderCart();

  document.getElementById("paid")
    .addEventListener("input", calculateChange);

  setupMenu();
});

/* ======================
   القائمة العلوية
====================== */
function setupMenu() {
  const btn = document.getElementById("menuBtn");
  const menu = document.getElementById("menuDropdown");

  btn.onclick = e => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  };

  document.addEventListener("click", () => {
    menu.classList.add("hidden");
  });
}

/* ======================
   الأصناف
====================== */
window.filterCategory = (cat, btn) => {
  document.querySelectorAll(".cat").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  loadItems(cat);
};

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
  const box = document.getElementById("items");
  box.innerHTML = "";

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <strong>${item.name}</strong>
      <span>${item.price.toFixed(3)} د.ب</span>
    `;
    div.onclick = () => addToCart(item);
    box.appendChild(div);
  });
}

/* ======================
   السلة
====================== */
function addToCart(item) {
  const found = cart.find(i => i.id === item.id);
  found ? found.qty++ : cart.push({ ...item, qty: 1 });
  renderCart();
}

function renderCart() {
  const tbody = document.getElementById("cart");
  tbody.innerHTML = "";
  let total = 0;

  cart.forEach((item, i) => {
    const sum = item.qty * item.price;
    total += sum;
    tbody.innerHTML += `
      <tr>
        <td>${item.name}</td>
        <td>${item.qty}</td>
        <td>${sum.toFixed(3)}</td>
        <td><button onclick="removeItem(${i})">🗑</button></td>
      </tr>
    `;
  });

  document.getElementById("total").textContent =
    total.toFixed(3) + " د.ب";

  calculateChange();
}

window.removeItem = i => {
  cart.splice(i, 1);
  renderCart();
};

/* ======================
   الدفع
====================== */
function calculateChange() {
  const paid = parseFloat(document.getElementById("paid").value) || 0;
  const total = parseFloat(document.getElementById("total").textContent) || 0;
  const change = paid - total;
  document.getElementById("change").textContent =
    change >= 0 ? change.toFixed(3) + " د.ب" : "—";
}

/* ======================
   إتمام الطلب
====================== */
window.completeOrder = async function () {
  if (!currentBusinessDay) {
    alert("اليوم مقفل");
    return;
  }
  if (!cart.length) return;

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  const { data: order } = await supabase
    .from("orders")
    .insert({
      total,
      status: "completed",
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

  cart = [];
  renderCart();
  loadActiveOrders();
};

/* ======================
   الطلبات الجارية
====================== */
async function loadActiveOrders() {
  if (!currentBusinessDay) return;

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "active")
    .eq("business_day_id", currentBusinessDay.id);

  activeOrders = data || [];
  renderActiveOrders();
}

function renderActiveOrders() {
  const box = document.getElementById("activeOrders");
  box.innerHTML = "";

  activeOrders.forEach(o => {
    const div = document.createElement("div");
    div.className = "order-box";
    div.innerHTML = `
      فاتورة #${o.id}<br>
      ${o.total.toFixed(3)} د.ب<br>
      <button onclick="deleteOrder('${o.id}')">🗑 حذف</button>
    `;
    box.appendChild(div);
  });
}

window.deleteOrder = async id => {
  await supabase.from("order_items").delete().eq("order_id", id);
  await supabase.from("orders").delete().eq("id", id);
  loadActiveOrders();
};

/* ======================
   إقفال اليوم
====================== */
window.closeDay = () => {
  window.location.href = "report.html";
};

/* ======================
   تنقل
====================== */
window.goToReports = () => location.href = "reports.html";
window.goToSettings = () => location.href = "settings.html";