import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

/*********************************
 * Get-Break | Cashier System
 *********************************/

let items = [];
let cart = [];
let activeOrders = [];
let currentBusinessDay = null;
let editingOrderId = null;
let paidOrders = new Set();

/* ===============================
   تحميل اليوم المفتوح
================================ */
async function loadCurrentDay() {
  const { data } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    currentBusinessDay = data;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const { data: newDay } = await supabase
    .from("business_days")
    .insert({
      day_date: today,
      is_open: true,
      opened_at: new Date().toISOString()
    })
    .select()
    .single();

  currentBusinessDay = newDay;
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  applyLang();
  await loadCurrentDay();

  if (!currentBusinessDay) {
    alert("❌ فشل تحميل يوم العمل");
    return;
  }

  await loadItems("food");
  await loadActiveOrders();

  setInterval(renderActiveOrders, 60000);

  renderCart();
  document.getElementById("paid")?.addEventListener("input", calculateChange);
});

/* ===============================
   الأصناف
================================ */
window.filterCategory = function (category, btn) {
  document.querySelectorAll(".cat").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  loadItems(category);
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
    div.onclick = () => handleItemClick(item);
    container.appendChild(div);
  });
}

/* ===============================
   الأحجام
================================ */
async function handleItemClick(item) {
  if (!item.has_variants) {
    addToCart({ id: item.id, name: item.name, price: item.price });
    return;
  }

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", item.id)
    .eq("active", true);

  if (!variants?.length) return alert("لا توجد أحجام");

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";
  overlay.innerHTML = `
    <div class="variant-box">
      <h3>${item.name}</h3>
      ${variants.map(v => `
        <button onclick="selectVariant('${item.id}','${item.name}','${v.id}','${v.label}',${v.price})">
          ${v.label} — ${v.price.toFixed(3)} د.ب
        </button>
      `).join("")}
      <button onclick="this.closest('.variant-overlay').remove()">إلغاء</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

window.selectVariant = function (id, name, variantId, label, price) {
  addToCart({ id, name: `${name} (${label})`, price, variant_id: variantId });
  document.querySelector(".variant-overlay")?.remove();
};

/* ===============================
   السلة
================================ */
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
window.removeItem = i => { cart.splice(i, 1); renderCart(); };

/* ===============================
   الدفع
================================ */
function calculateChange() {
  const paid = parseFloat(document.getElementById("paid").value) || 0;
  const total = parseFloat(document.getElementById("total").textContent) || 0;
  document.getElementById("change").textContent =
    paid >= total && paid ? (paid - total).toFixed(3) + " د.ب" : "—";
}

/* ===============================
   إتمام الطلب
================================ */
window.completeOrder = async function () {
  if (!cart.length) return alert("الفاتورة فارغة");

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

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

  cart = [];
  renderCart();
  loadActiveOrders();
};

/* ===============================
   الطلبات الجارية
================================ */
async function loadActiveOrders() {
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
  box.innerHTML = "";

  activeOrders.forEach(order => {
    const div = document.createElement("div");
    div.className = "order-box";

    const mins = Math.max(0, (Date.now() - new Date(order.created_at)) / 60000);

    // بدون لون // الحالة الافتراضية (جديد – بدون لون)
div.style.background = "transparent";
div.style.border = "1px solid #E5E7EB";

// 🟢 مدفوع قبل 10 دقائق → أخضر كامل فورًا
if (order.is_paid && mins < 10) {
  div.style.background = "#d4f8d4";
  div.style.border = "1px solid #3cb371";
}

// ⏱️ بعد 10 دقائق
else if (mins >= 10 && mins < 20) {
  div.style.background = order.is_paid
    ? "linear-gradient(to right, #d4f8d4 50%, #fff3cd 50%)"
    : "#fff3cd";
  div.style.border = "1px solid #f0ad4e";
}

// ⏱️ بعد 20 دقيقة
else if (mins >= 20) {
  div.style.background = order.is_paid
    ? "linear-gradient(to right, #d4f8d4 50%, #f8d7da 50%)"
    : "#f8d7da";
  div.style.border = "1px solid #dc3545";
}

    div.innerHTML = `
      <strong>فاتورة ${order.invoice_no ?? order.id.slice(0,6)}</strong><br>
      ${order.total.toFixed(3)} د.ب<br>
      <button onclick="editOrder('${order.id}')">✏️ تعديل</button>
      <button onclick="markCompleted('${order.id}')">✅ مكتمل</button>
      <button onclick="deleteOrder('${order.id}')">🗑 حذف</button>
      ${order.is_paid ? "" : `<button onclick="markPaid('${order.id}')">💰 تم الدفع</button>`}
    `;

    box.appendChild(div);
  });
}

/* ===============================
   تم الدفع
================================ */
window.markPaid = async function (orderId) {
  await supabase.from("orders").update({
    is_paid: true,
    paid_at: new Date().toISOString()
  }).eq("id", orderId);

  paidOrders.add(orderId);
  renderActiveOrders();
};

/* ===============================
   تعديل / مكتمل / حذف
================================ */
window.editOrder = async function (orderId) {
  editingOrderId = orderId;
  const { data } = await supabase
    .from("order_items")
    .select(`qty, price, products (id,name)`)
    .eq("order_id", orderId);

  cart = data.map(i => ({
    id: i.products.id,
    name: i.products.name,
    price: i.price,
    qty: i.qty,
    key: i.products.id
  }));
  renderCart();
};

window.markCompleted = async id => {
  await supabase.from("orders").update({
    status: "completed",
    closed_at: new Date().toISOString()
  }).eq("id", id);
  loadActiveOrders();
};

window.deleteOrder = async id => {
  if (!confirm("حذف الفاتورة؟")) return;
  await supabase.from("order_items").delete().eq("order_id", id);
  await supabase.from("orders").delete().eq("id", id);
  loadActiveOrders();
};
