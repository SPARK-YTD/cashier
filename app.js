import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

/* ===============================
   الحالة العامة
================================ */
let items = [];
let cart = [];
let activeOrders = [];
let editingOrderId = null;
let currentBusinessDay = null;

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
    .single();

  currentBusinessDay = data || null;

  const statusEl = document.getElementById("dayStatus");
  if (statusEl) {
    statusEl.textContent = currentBusinessDay
      ? `🟢 اليوم مفتوح`
      : `🔴 اليوم مقفل`;
  }
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  applyLang();
  await loadCurrentDay();

  if (!currentBusinessDay) {
    alert("❌ اليوم مقفل — اذهب للتقرير وابدأ يوم جديد");
    disableCashier();
    return;
  }

  await loadItems("food");
  await loadActiveOrders();
  renderCart();

  const paid = document.getElementById("paid");
  if (paid) paid.addEventListener("input", calculateChange);
});

/* ===============================
   تعطيل الكاشير إذا اليوم مقفل
================================ */
function disableCashier() {
  document.querySelectorAll("button").forEach(b => b.disabled = true);
}

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
  const box = document.getElementById("items");
  box.innerHTML = "";

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      ${item.image_url ? `<img src="${item.image_url}" class="cashier-item-img">` : ""}
      <strong>${item.name}</strong>
      <span>${item.has_variants ? "اختر الحجم" : item.price.toFixed(3) + " د.ب"}</span>
    `;
    div.onclick = () => handleItemClick(item);
    box.appendChild(div);
  });
}

/* ===============================
   الأحجام
================================ */
async function handleItemClick(item) {
  if (!item.has_variants) {
    addToCart(item);
    return;
  }

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", item.id)
    .eq("active", true);

  showVariantPopup(item, variants);
}

function showVariantPopup(item, variants) {
  let overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box">
      <h3>${item.name}</h3>
      ${variants.map(v => `
        <button class="variant-btn"
          onclick="selectVariant('${item.id}','${item.name}','${v.label}',${v.price})">
          ${v.label} — ${v.price.toFixed(3)} د.ب
        </button>
      `).join("")}
      <button class="variant-cancel" onclick="closeVariant()">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);
}

window.selectVariant = (id, name, label, price) => {
  addToCart({
    id,
    name: `${name} (${label})`,
    price,
    key: `${id}-${label}`
  });
  closeVariant();
};

window.closeVariant = () => {
  document.querySelector(".variant-overlay")?.remove();
};

/* ===============================
   السلة
================================ */
function addToCart(item) {
  const key = item.key || item.id;
  const found = cart.find(i => i.key === key);
  found ? found.qty++ : cart.push({ ...item, key, qty: 1 });
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
        <td>
          <button onclick="changeQty(${idx},-1)">-</button>
          ${i.qty}
          <button onclick="changeQty(${idx},1)">+</button>
        </td>
        <td>${sum.toFixed(3)} د.ب</td>
        <td><button onclick="removeItem(${idx})">🗑</button></td>
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

/* ===============================
   الدفع
================================ */
function calculateChange() {
  const paid = parseFloat(paidInput.value) || 0;
  const total = parseFloat(totalEl.textContent) || 0;
  change.textContent =
    paid >= total ? (paid - total).toFixed(3) + " د.ب" : "—";
}

/* ===============================
   إتمام الطلب
================================ */
window.completeOrder = async function () {
  if (!cart.length) return alert("الفاتورة فارغة");

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  if (editingOrderId) {
    await supabase.from("orders").update({ total }).eq("id", editingOrderId);
    await supabase.from("order_items").delete().eq("order_id", editingOrderId);
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

    editingOrderId = order.id;
  }

  await supabase.from("order_items").insert(
    cart.map(i => ({
      order_id: editingOrderId,
      product_id: i.id,
      qty: i.qty,
      price: i.price
    }))
  );

  editingOrderId = null;
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

  activeOrders.forEach(o => {
    const div = document.createElement("div");
    div.className = "order-box";
    div.innerHTML = `
      <strong>فاتورة ${o.invoice_no}</strong><br>
      ${o.total.toFixed(3)} د.ب<br>
      <button onclick="editOrder('${o.id}')">✏️ تعديل</button>
      <button onclick="deleteOrder('${o.id}')">🗑 حذف</button>
      <button onclick="markCompleted('${o.id}')">✅ مكتمل</button>
    `;
    box.appendChild(div);
  });
}

window.editOrder = async id => {
  editingOrderId = id;
  const { data } = await supabase
    .from("order_items")
    .select(`qty, price, products (id,name)`)
    .eq("order_id", id);

  cart = data.map(i => ({
    id: i.products.id,
    name: i.products.name,
    price: i.price,
    qty: i.qty,
    key: i.products.id
  }));
  renderCart();
};

window.deleteOrder = async id => {
  if (!confirm("حذف الفاتورة نهائيًا؟")) return;
  await supabase.from("order_items").delete().eq("order_id", id);
  await supabase.from("orders").delete().eq("id", id);
  loadActiveOrders();
};

window.markCompleted = async id => {
  await supabase.from("orders").update({ status: "completed" }).eq("id", id);
  loadActiveOrders();
};

/* ===============================
   إقفال اليوم
================================ */
window.closeDay = async function () {
  const pass = prompt("🔒 كلمة المرور:");
  if (pass !== "1234") return;

  await supabase
    .from("business_days")
    .update({ is_open: false, closed_at: new Date().toISOString() })
    .eq("id", currentBusinessDay.id);

  window.location.href = "report.html";
};

/* ===============================
   تنقل
================================ */
window.goToSettings = () => location.href = "settings.html";
window.goToReports  = () => location.href = "report.html";