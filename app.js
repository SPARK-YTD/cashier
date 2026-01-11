import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

/*********************************
 * Get-Break | Cashier System (FIXED)
 *********************************/

let items = [];
let cart = [];
let activeOrders = [];
let editingOrderId = null;

/* ========= INIT ========= */
document.addEventListener("DOMContentLoaded", async () => {
  applyLang();
  await loadItems("food");
  await loadActiveOrders();
  renderCart();

  const paid = document.getElementById("paid");
  if (paid) paid.addEventListener("input", calculateChange);
});

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
      <strong>${item.name}</strong>
      <span>${item.price.toFixed(3)} د.ب</span>
    `;
    div.onclick = () => addToCart(item);
    container.appendChild(div);
  });
}

/* ========= CART ========= */
function addToCart(item) {
  const key = item.variant_id
    ? `${item.id}-${item.variant_id}`
    : item.id;

  const found = cart.find(i => i.key === key);
  if (found) found.qty++;
  else cart.push({ ...item, key, qty: 1 });

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
        <td>
          <button onclick="changeQty(${i},-1)">-</button>
          ${item.qty}
          <button onclick="changeQty(${i},1)">+</button>
        </td>
        <td>${sum.toFixed(3)} د.ب</td>
        <td><button onclick="removeItem(${i})">🗑</button></td>
      </tr>
    `;
  });

  document.getElementById("total").textContent = total.toFixed(3) + " د.ب";
  calculateChange();
}

window.changeQty = (i, d) => {
  cart[i].qty += d;
  if (cart[i].qty <= 0) cart.splice(i, 1);
  renderCart();
};

window.removeItem = i => {
  cart.splice(i, 1);
  renderCart();
};

/* ========= PAYMENT ========= */
function calculateChange() {
  const paid = parseFloat(document.getElementById("paid").value) || 0;
  const total = parseFloat(document.getElementById("total").textContent) || 0;
  const change = paid - total;
  document.getElementById("change").textContent =
    change >= 0 && paid ? change.toFixed(3) + " د.ب" : "—";
}

/* ========= COMPLETE ORDER ========= */
window.completeOrder = async function () {
  if (!cart.length) return alert("الفاتورة فارغة");

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  if (editingOrderId) {
    await supabase.from("orders")
      .update({ total, status: "active" })
      .eq("id", editingOrderId);

    await supabase.from("order_items")
      .delete()
      .eq("order_id", editingOrderId);

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
      .insert({ total, status: "active" })
      .select()
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
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("status", "active")
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
      <strong>طلب #${order.id.slice(0,6)}</strong><br>
      ${order.total.toFixed(3)} د.ب<br>
      <button onclick="editOrder('${order.id}')">✏️ تعديل</button>
      <button onclick="markCompleted('${order.id}')">✅ مكتمل</button>
    `;
    box.appendChild(div);
  });
}

/* ========= EDIT ORDER (FIXED) ========= */
window.editOrder = async function (orderId) {
  editingOrderId = orderId;

  const { data } = await supabase
    .from("order_items")
    .select("product_id, qty, price, products(name)")
    .eq("order_id", orderId);

  cart = data.map(i => ({
    id: i.product_id,
    name: i.products.name,
    price: i.price,
    qty: i.qty,
    key: i.product_id
  }));

  renderCart();
};

/* ========= STATUS ========= */
window.markCompleted = async id => {
  await supabase.from("orders")
    .update({ status: "completed" })
    .eq("id", id);

  loadActiveOrders();
};

/* ========= CLOSE DAY ========= */
window.closeDay = async function () {
  const pass = prompt("🔒 أدخل كلمة المرور:");
  if (pass !== "1234") return;

  const { data: orders } = await supabase
    .from("orders")
    .select("id,total,order_items(qty,price,products(name))")
    .eq("status", "completed")
    .is("closed_at", null);

  if (!orders?.length) return alert("لا توجد طلبات");

  let totalSales = 0;
  const itemsMap = {};

  orders.forEach(o => {
    totalSales += o.total;
    o.order_items.forEach(i => {
      itemsMap[i.products.name] ??= { qty: 0, total: 0 };
      itemsMap[i.products.name].qty += i.qty;
      itemsMap[i.products.name].total += i.qty * i.price;
    });
  });

  await supabase.from("daily_reports").insert({
    report_date: new Date().toISOString().slice(0,10),
    orders_count: orders.length,
    total_sales: totalSales,
    items: itemsMap
  });

  await supabase.from("orders")
    .update({ closed_at: new Date().toISOString() })
    .in("id", orders.map(o => o.id));

  window.location.href = "report.html";
};