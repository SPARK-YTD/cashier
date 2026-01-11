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

/* ========= CATEGORIES ========= */
window.filterCategory = (category, btn) => {
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
  const box = document.getElementById("items");
  if (!box) return;
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

/* ========= VARIANTS ========= */
async function handleItemClick(item) {
  if (!item.has_variants) return addToCart(item);

  const { data } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", item.id)
    .eq("active", true);

  if (!data?.length) return alert("لا توجد أحجام");
  showVariantPopup(item, data);
}

function showVariantPopup(item, variants) {
  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";
  overlay.innerHTML = `
    <div class="variant-box">
      <h3>${item.name}</h3>
      ${variants.map(v => `
        <button class="variant-btn"
          onclick="selectVariant('${item.id}','${item.name}','${v.id}','${v.label}',${v.price})">
          ${v.label} — ${v.price.toFixed(3)} د.ب
        </button>`).join("")}
      <button class="variant-cancel" onclick="closeVariantPopup()">إلغاء</button>
    </div>`;
  document.body.appendChild(overlay);
}

window.selectVariant = (pid, name, vid, label, price) => {
  addToCart({ id: pid, name: `${name} (${label})`, price, variant_id: vid });
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
  const paid = +document.getElementById("paid").value || 0;
  const total = +document.getElementById("total").textContent || 0;
  const change = paid - total;
  document.getElementById("change").textContent =
    change >= 0 && paid ? change.toFixed(3) + " د.ب" : "—";
}

/* ========= COMPLETE ORDER ========= */
window.completeOrder = async () => {
  if (!cart.length) return alert("الفاتورة فارغة");
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  if (editingOrderId) {
    await supabase.from("order_items").delete().eq("order_id", editingOrderId);
    await supabase.from("order_items").insert(
      cart.map(i => ({
        order_id: editingOrderId,
        product_id: i.id,
        qty: i.qty,
        price: i.price
      }))
    );
    await supabase
      .from("orders")
      .update({ total, status: "active" })
      .eq("id", editingOrderId);

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

  activeOrders.forEach(o => {
    box.innerHTML += `
      <div class="order-box">
        <strong>طلب #${o.id.slice(0,6)}</strong><br>
        ${o.total.toFixed(3)} د.ب<br>
        <button onclick="editOrder('${o.id}')">✏️ تعديل</button>
        <button onclick="markCompleted('${o.id}')">✅ مكتمل</button>
        <button onclick="cancelOrder('${o.id}')">❌ إلغاء</button>
      </div>`;
  });
}

/* ========= EDIT ORDER ========= */
window.editOrder = async id => {
  editingOrderId = id;

  // إخفاء الطلب من الجارية ومنع احتسابه
  await supabase.from("orders").update({ status: "editing" }).eq("id", id);
  loadActiveOrders();

  const { data } = await supabase
    .from("order_items")
    .select(`qty, price, products(id,name)`)
    .eq("order_id", id);

  cart = data.map(i => ({
    id: i.products.id,
    name: i.products.name,
    price: i.price,
    qty: i.qty,
    key: Math.random()
  }));
  renderCart();
};

/* ========= STATUS ========= */
window.markCompleted = async id => {
  await supabase.from("orders").update({ status: "completed" }).eq("id", id);
  loadActiveOrders();
};

window.cancelOrder = async id => {
  await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
  loadActiveOrders();
};

/* ========= CLOSE DAY (عرض فقط) ========= */
window.closeDay = async () => {
  const pass = prompt("🔒 أدخل كلمة المرور لإقفال اليوم:");
  if (pass !== "1234") return alert("❌ كلمة المرور غير صحيحة");
  window.location.href = "report.html?preview=1";
};

/* ========= NAV ========= */
window.goToSettings = () => location.href = "settings.html";
window.goToReports  = () => location.href = "reports.html";