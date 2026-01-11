import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

/*********************************
 * Get-Break | Cashier System
 *********************************/

let items = [];
let cart = [];
let activeOrders = [];

/* ========= INIT ========= */
document.addEventListener("DOMContentLoaded", async () => {
  applyLang();
  await loadItems("food");
  await loadActiveOrders();
  renderCart();

  const paid = document.getElementById("paid");
  if (paid) paid.addEventListener("input", calculateChange);
});

/* ========= CATEGORIES ========= */
window.filterCategory = function (category, btn) {
  document.querySelectorAll(".cat").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  loadItems(category);
};

/* ========= ITEMS ========= */
async function loadItems(category) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("category", category)
    .eq("active", true);

  if (error) return alert("خطأ في تحميل الأصناف");

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

/* ========= VARIANTS ========= */
async function handleItemClick(item) {
  if (!item.has_variants) return addToCart(item);

  const { data: variants } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", item.id)
    .eq("active", true);

  if (!variants?.length) return alert("لا توجد أحجام");

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
        <button class="variant-btn"
          onclick="selectVariant('${item.id}','${item.name}','${v.id}','${v.label}',${v.price})">
          ${v.label} — ${v.price.toFixed(3)} د.ب
        </button>
      `).join("")}
      <button class="variant-cancel" onclick="closeVariantPopup()">إلغاء</button>
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

window.closeVariantPopup = function () {
  const overlay = document.querySelector(".variant-overlay");
  if (overlay) overlay.remove();
};

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
        <td>
          <button onclick="changeQty(${i},-1)">-</button>
          ${item.qty}
          <button onclick="changeQty(${i},1)">+</button>
        </td>
        <td>${sum.toFixed(3)} د.ب</td>
        <td><button onclick="removeItem(${i})">🗑</button></td>
      </tr>`;
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

  const { data: order } = await supabase
    .from("orders")
    .insert({ total, status: "active" })
    .select()
    .single();

  const orderItems = cart.map(i => ({
    order_id: order.id,
    product_id: i.id,
    qty: i.qty,
    price: i.price
  }));

  await supabase.from("order_items").insert(orderItems);

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
}

window.markCompleted = async function (id) {
  await supabase.from("orders").update({ status: "completed" }).eq("id", id);
  loadActiveOrders();
};

/* ========= CLOSE DAY ========= */
window.closeDay = async function () {
  const pass = prompt("🔒 أدخل كلمة المرور لإقفال اليوم:");
  if (pass !== "1234") return alert("❌ كلمة المرور غير صحيحة");

  const today = new Date().toISOString().slice(0, 10);

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      total,
      created_at,
      order_items (
        qty,
        price,
        products ( name )
      )
    `)
    .eq("status", "completed")
    .gte("created_at", today + "T00:00:00")
    .lte("created_at", today + "T23:59:59");

  if (!orders?.length) return alert("لا توجد طلبات مكتملة اليوم");

  let totalSales = 0;
  const itemsMap = {};

  orders.forEach(o => {
    totalSales += o.total;
    o.order_items.forEach(i => {
      const name = i.products.name;
      itemsMap[name] ??= { qty: 0, total: 0 };
      itemsMap[name].qty += i.qty;
      itemsMap[name].total += i.qty * i.price;
    });
  });

  const topItem = Object.entries(itemsMap)
    .sort((a, b) => b[1].qty - a[1].qty)[0]?.[0] || "—";

  await supabase.from("daily_reports").insert({
    report_date: today,
    orders_count: orders.length,
    total_sales: totalSales,
    top_item: topItem,
    items: itemsMap
  });

  alert("✅ تم إقفال اليوم");
  window.location.href = "report.html";
};

/* ========= NAV ========= */
window.goToSettings = () => (window.location.href = "settings.html");
window.goToReports = () => (window.location.href = "reports.html");