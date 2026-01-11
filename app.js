import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

/*********************************
 * Get-Break | Cashier System
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

  // ربط زر إقفال اليوم (حل مشكلة closeDay)
  const closeBtn = document.getElementById("closeDayBtn");
  if (closeBtn) closeBtn.addEventListener("click", closeDay);
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

/* ========= COMPLETE ORDER (NO DUPLICATION) ========= */
window.completeOrder = async function () {
  if (!cart.length) return alert("الفاتورة فارغة");

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  if (editingOrderId) {
    await supabase.from("orders")
      .update({ total })
      .eq("id", editingOrderId);

    // UPSERT يمنع التكرار نهائيًا
    await supabase.from("order_items").upsert(
      cart.map(i => ({
        order_id: editingOrderId,
        product_id: i.id,
        qty: i.qty,
        price: i.price
      })),
      { onConflict: "order_id,product_id" }
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
      <button onclick="cancelOrder('${order.id}')">❌ إلغاء</button>
    `;
    box.appendChild(div);
  });
}

/* ========= EDIT ORDER ========= */
window.editOrder = async function (orderId) {
  if (editingOrderId === orderId) return;

  editingOrderId = orderId;
  cart = [];
  renderCart();

  // إزالة الطلب من الجارية أثناء التعديل
  activeOrders = activeOrders.filter(o => o.id !== orderId);
  renderActiveOrders();

  const { data } = await supabase
    .from("order_items")
    .select(`qty, price, products ( id, name )`)
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

/* ========= STATUS ========= */
window.markCompleted = async id => {
  await supabase.from("orders")
    .update({ status: "completed" })
    .eq("id", id);

  loadActiveOrders();
};

window.cancelOrder = async id => {
  await supabase.from("orders")
    .update({ status: "cancelled" })
    .eq("id", id);

  loadActiveOrders();
};

/* ========= CLOSE DAY ========= */
async function closeDay() {
  const pass = prompt("🔒 أدخل كلمة المرور لإقفال اليوم:");
  if (pass !== "1234") return alert("❌ كلمة المرور غير صحيحة");

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      id,
      total,
      order_items (
        qty,
        price,
        products ( name )
      )
    `)
    .eq("status", "completed")
    .is("closed_at", null);

  if (!orders?.length) return alert("لا توجد طلبات مكتملة");

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

  await supabase.from("daily_reports").insert({
    report_date: new Date().toISOString().slice(0,10),
    orders_count: orders.length,
    total_sales: totalSales,
    top_item: Object.keys(itemsMap)[0] || "—",
    items: itemsMap
  });

  await supabase
    .from("orders")
    .update({ closed_at: new Date().toISOString() })
    .in("id", orders.map(o => o.id));

  alert("✅ تم إقفال اليوم");
  window.location.href = "report.html";
}

/* ========= NAV ========= */
window.goToSettings = () => location.href = "settings.html";
window.goToReports  = () => location.href = "reports.html";
