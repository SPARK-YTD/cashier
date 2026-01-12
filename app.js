import { supabase } from "./supabase.js";

/* ===============================
   MENU
================================ */
const menuBtn = document.getElementById("menuBtn");
const menuBox = document.getElementById("menuBox");

menuBtn.onclick = e => {
  e.stopPropagation();
  menuBox.classList.toggle("hidden");
};
document.body.onclick = () => menuBox.classList.add("hidden");

/* ===============================
   GLOBAL
================================ */
let items = [];
let cart = [];
let activeOrders = [];
let currentDay = null;

/* ===============================
   LOAD DAY
================================ */
async function loadDay() {
  const { data } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .limit(1)
    .single();

  currentDay = data || null;
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await loadDay();
  await loadItems("food");
  await loadActiveOrders();
});

/* ===============================
   ITEMS
================================ */
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

  items.forEach(i => {
    const d = document.createElement("div");
    d.className = "item";
    d.innerHTML = `<strong>${i.name}</strong><span>${i.price?.toFixed(3) ?? "أحجام"}</span>`;
    d.onclick = () => addToCart(i);
    box.appendChild(d);
  });
}

/* ===============================
   CART
================================ */
function addToCart(item) {
  const found = cart.find(i => i.id === item.id);
  found ? found.qty++ : cart.push({ ...item, qty: 1 });
  renderCart();
}

function renderCart() {
  const box = document.getElementById("cart");
  box.innerHTML = "";
  let total = 0;

  cart.forEach((i, idx) => {
    total += i.qty * i.price;
    box.innerHTML += `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td>${(i.qty*i.price).toFixed(3)}</td>
        <td><button onclick="removeItem(${idx})">🗑</button></td>
      </tr>
    `;
  });

  document.getElementById("total").textContent = total.toFixed(3);
}

window.removeItem = i => {
  cart.splice(i,1);
  renderCart();
};

/* ===============================
   COMPLETE ORDER
================================ */
window.completeOrder = async () => {
  if (!cart.length) return alert("الفاتورة فارغة");

  const total = cart.reduce((s,i)=>s+i.qty*i.price,0);

  const { data: order } = await supabase
    .from("orders")
    .insert({
      total,
      status: "completed",
      business_day_id: currentDay?.id
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

/* ===============================
   ACTIVE ORDERS
================================ */
async function loadActiveOrders() {
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "completed")
    .eq("business_day_id", currentDay?.id);

  activeOrders = data || [];
  renderOrders();
}

function renderOrders() {
  const box = document.getElementById("activeOrders");
  box.innerHTML = "";

  activeOrders.forEach(o => {
    const d = document.createElement("div");
    d.className = "order-box";
    d.innerHTML = `
      فاتورة #${o.id}<br>
      ${o.total.toFixed(3)} د.ب<br>
      <button onclick="deleteOrder('${o.id}')">🗑 حذف نهائي</button>
    `;
    box.appendChild(d);
  });
}

window.deleteOrder = async id => {
  await supabase.from("order_items").delete().eq("order_id", id);
  await supabase.from("orders").delete().eq("id", id);
  loadActiveOrders();
};

/* ===============================
   CLOSE DAY
================================ */
window.closeDay = () => {
  window.location.href = "report.html";
};

window.goToReports = () => location.href="reports.html";
window.goToSettings = () => location.href="settings.html";