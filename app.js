import { supabase } from "./supabase.js";

/* ===============================
   STATE
================================ */
let items = [];
let cart = [];
let activeOrders = [];
let currentBusinessDay = null;

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  await loadCurrentDay();
  await loadItems("food");
  await loadActiveOrders();
  renderCart();

  document.getElementById("paid")
    ?.addEventListener("input", calculateChange);

  setupMenu();
});

/* ===============================
   HEADER MENU
================================ */
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

/* ===============================
   BUSINESS DAY
================================ */
async function loadCurrentDay() {
  const { data } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .order("opened_at", { ascending: false })
    .limit(1)
    .single();

  currentBusinessDay = data || null;

  if (!currentBusinessDay) {
    alert("⚠️ لا يوجد يوم مفتوح، اذهب للتقرير وابدأ يوم جديد");
  }
}

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

/* ===============================
   CART
================================ */
function addToCart(item) {
  const found = cart.find(i => i.id === item.id);
  found ? found.qty++ : cart.push({ ...item, qty: 1 });
  renderCart();
}

function renderCart() {
  const tbody = document.getElementById("cart");
  tbody.innerHTML = "";
  let total = 0;

  cart.forEach((i, idx) => {
    const sum = i.qty * i.price;
    total += sum;
    tbody.innerHTML += `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td>${sum.toFixed(3)}</td>
        <td><button onclick="removeItem(${idx})">🗑</button></td>
      </tr>
    `;
  });

  document.getElementById("total").textContent = total.toFixed(3);
  calculateChange();
}

window.removeItem = i => {
  cart.splice(i,1);
  renderCart();
};

/* ===============================
   PAYMENT
================================ */
function calculateChange() {
  const paid = parseFloat(document.getElementById("paid").value) || 0;
  const total = parseFloat(document.getElementById("total").textContent) || 0;
  const change = paid - total;
  document.getElementById("change").textContent =
    change >= 0 && paid ? change.toFixed(3) : "—";
}

/* ===============================
   COMPLETE ORDER
================================ */
window.completeOrder = async () => {
  if (!currentBusinessDay) return alert("اليوم مقفل");
  if (!cart.length) return alert("الفاتورة فارغة");

  const total = cart.reduce((s,i)=>s+i.qty*i.price,0);

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

/* ===============================
   ACTIVE ORDERS
================================ */
async function loadActiveOrders() {
  if (!currentBusinessDay) return;

  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("business_day_id", currentBusinessDay.id)
    .eq("status", "completed");

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
      <button onclick="deleteOrder('${o.id}')">🗑 حذف نهائي</button>
    `;
    box.appendChild(div);
  });
}

window.deleteOrder = async id => {
  if (!confirm("حذف الفاتورة نهائيًا؟")) return;
  await supabase.from("order_items").delete().eq("order_id", id);
  await supabase.from("orders").delete().eq("id", id);
  loadActiveOrders();
};

/* ===============================
   CLOSE DAY
================================ */
window.closeDay = async () => {
  if (!currentBusinessDay) return;

  const pass = prompt("كلمة المرور:");
  if (pass !== "1234") return;

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      total,
      order_items(qty,price,products(name))
    `)
    .eq("business_day_id", currentBusinessDay.id);

  let totalSales = 0;
  const items = {};

  orders.forEach(o => {
    totalSales += o.total;
    o.order_items.forEach(i => {
      items[i.products.name] ??= { qty:0,total:0 };
      items[i.products.name].qty += i.qty;
      items[i.products.name].total += i.qty*i.price;
    });
  });

  await supabase.from("daily_reports").insert({
    business_day_id: currentBusinessDay.id,
    report_date: currentBusinessDay.day_date,
    orders_count: orders.length,
    total_sales: totalSales,
    items
  });

  await supabase.from("business_days")
    .update({ is_open:false, closed_at:new Date() })
    .eq("id", currentBusinessDay.id);

  location.href = "report.html";
};

/* ===============================
   NAV
================================ */
window.goToReports = () => location.href = "report.html";
window.goToSettings = () => location.href = "settings.html";