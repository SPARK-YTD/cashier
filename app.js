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
  document.querySelectorAll(".cat").forEach(b =>
    b.classList.remove("active")
  );
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

  if (error) {
    alert("خطأ في تحميل الأصناف");
    console.error(error);
    return;
  }

  items = data || [];
  renderItems();
}

function renderItems() {
  const container = document.getElementById("items");
  if (!container) return;

  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = "<p>لا توجد أصناف</p>";
    return;
  }

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";

    div.innerHTML = `
      ${item.image_url ? `<img src="${item.image_url}" class="cashier-item-img">` : ""}
      <strong>${item.name}</strong>
      <span>
        ${item.has_variants ? "اختر الحجم" : item.price.toFixed(3) + " د.ب"}
      </span>
    `;

    div.onclick = () => handleItemClick(item);
    container.appendChild(div);
  });
}

/* ========= ITEM CLICK ========= */
async function handleItemClick(item) {
  if (!item.has_variants) {
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price
    });
    return;
  }

  const { data: variants, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", item.id);

  if (error || !variants || variants.length === 0) {
    alert("لا توجد أحجام لهذا الصنف");
    return;
  }

  showVariantPopup(item, variants);
}

/* ========= VARIANTS POPUP ========= */
function showVariantPopup(item, variants) {
  closeVariantPopup();

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box">
      <h3>${item.name}</h3>

      ${variants.map(v => `
        <button class="variant-btn"
          onclick="selectVariant(
            '${item.id}',
            '${item.name}',
            '${v.id}',
            '${v.label}',
            ${v.price}
          )">
          ${v.label} — ${v.price.toFixed(3)} د.ب
        </button>
      `).join("")}

      <button class="variant-cancel" onclick="closeVariantPopup()">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);
}

window.selectVariant = function (productId, productName, variantId, label, price) {
  addToCart({
    id: productId,
    name: `${productName} (${label})`,
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

  if (found) {
    found.qty++;
  } else {
    cart.push({ ...item, key, qty: 1 });
  }

  renderCart();
}

function renderCart() {
  const tbody = document.getElementById("cart");
  if (!tbody) return;

  tbody.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const sum = item.qty * item.price;
    total += sum;

    tbody.innerHTML += `
      <tr>
        <td>${item.name}</td>
        <td>
          <button onclick="changeQty(${index},-1)">-</button>
          ${item.qty}
          <button onclick="changeQty(${index},1)">+</button>
        </td>
        <td>${sum.toFixed(3)} د.ب</td>
        <td><button onclick="removeItem(${index})">🗑</button></td>
      </tr>
    `;
  });

  document.getElementById("total").textContent =
    total.toFixed(3) + " د.ب";

  calculateChange();
}

window.changeQty = function (index, delta) {
  cart[index].qty += delta;
  if (cart[index].qty <= 0) cart.splice(index, 1);
  renderCart();
};

window.removeItem = function (index) {
  cart.splice(index, 1);
  renderCart();
};

/* ========= PAYMENT ========= */
function calculateChange() {
  const paid = parseFloat(document.getElementById("paid").value) || 0;
  const total =
    parseFloat(document.getElementById("total").textContent) || 0;

  const change = paid - total;
  document.getElementById("change").textContent =
    change >= 0 && paid > 0 ? change.toFixed(3) + " د.ب" : "—";
}

/* ========= ORDERS ========= */
window.completeOrder = async function () {
  if (cart.length === 0) {
    alert("الفاتورة فارغة");
    return;
  }

  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  const { data: order, error } = await supabase
    .from("orders")
    .insert({ total, status: "active" })
    .select()
    .single();

  if (error) {
    alert("فشل حفظ الطلب");
    console.error(error);
    return;
  }

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
      <strong>طلب #${order.id.slice(0, 6)}</strong><br>
      ${order.total.toFixed(3)} د.ب<br>
      <button onclick="markCompleted('${order.id}')">مكتمل</button>
      <button onclick="cancelOrder('${order.id}')">إلغاء</button>
    `;
    box.appendChild(div);
  });
}

window.markCompleted = async function (id) {
  await supabase.from("orders").update({ status: "completed" }).eq("id", id);
  loadActiveOrders();
};

window.cancelOrder = async function (id) {
  await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
  loadActiveOrders();
};

/* ========= NAV ========= */
window.goToSettings = function () {
  window.location.href = "settings.html";
};