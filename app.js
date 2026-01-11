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

/* ========= VARIANTS ========= */
async function handleItemClick(item) {
  if (!item.has_variants) {
    addToCart(item);
    return;
  }

  const { data: variants, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", item.id)
    .eq("active", true);

  if (error || !variants || variants.length === 0) {
    alert("لا توجد أحجام لهذا الصنف");
    return;
  }

  showVariantPopup(item, variants);
}

function showVariantPopup(item, variants) {
  let overlay = document.querySelector(".variant-overlay");

  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "variant-overlay hidden";
    document.body.appendChild(overlay);
  }

  overlay.classList.remove("hidden");

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
  if (overlay) {
    overlay.classList.add("hidden");
    overlay.innerHTML = "";
  }
};

/* ========= CART ========= */
function addToCart(item) {
  const key = item.variant_id ? `${item.id}-${item.variant_id}` : item.id;
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

/* ========= NAV ========= */
window.goToSettings = () => window.location.href = "settings.html";

window.goToReports = function () {
  const pass = prompt("🔒 أدخل كلمة المرور:");
  if (pass === "1234") window.location.href = "reports.html";
};