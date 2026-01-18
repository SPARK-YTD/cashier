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

/* ===============================
   تحميل اليوم المفتوح (مُصحح)
================================ */
async function loadCurrentDay() {
  const { data, error } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // ✅ إذا فيه يوم مفتوح
  if (data) {
    currentBusinessDay = data;
    return;
  }

  // 🟡 إذا ما فيه يوم مفتوح → نفتح يوم جديد تلقائي
  const today = new Date().toISOString().slice(0, 10);

  const { data: newDay, error: createError } = await supabase
    .from("business_days")
    .insert({
      day_date: today,
      is_open: true,
      opened_at: new Date().toISOString()
    })
    .select()
    .single();

  if (createError) {
    console.error("FAILED TO CREATE BUSINESS DAY:", createError);
    currentBusinessDay = null;
    return;
  }

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

  if (!variants?.length) {
    alert("لا توجد أحجام");
    return;
  }

  showVariantsPopup(item, variants);
}

function showVariantsPopup(item, variants) {
  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box">
      <h3>${item.name}</h3>
      ${variants.map(v => `
        <button class="variant-btn"
          onclick="selectVariant('${item.id}','${item.name}','${v.id}','${v.label}',${v.price})">
          ${v.label} — ${v.price.toFixed(3)} د.ب
        </button>
      `).join("")}
      <button class="variant-cancel" onclick="this.closest('.variant-overlay').remove()">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);
}

window.selectVariant = function (productId, name, variantId, label, price) {
  addToCart({
    id: productId,
    name: `${name} (${label})`,
    price,
    variant_id: variantId
  });
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

window.removeItem = i => {
  cart.splice(i, 1);
  renderCart();
};

/* ===============================
   الدفع
================================ */
function calculateChange() {
  const paid = parseFloat(document.getElementById("paid").value) || 0;
  const total = parseFloat(document.getElementById("total").textContent) || 0;
  const change = paid - total;
  document.getElementById("change").textContent =
    change >= 0 && paid ? change.toFixed(3) + " د.ب" : "—";
}

/* ===============================
   إتمام الطلب (جديد / تعديل)
================================ */
window.completeOrder = async function () {
  if (!cart.length) return alert("الفاتورة فارغة");

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  if (editingOrderId) {
    await supabase.from("orders").update({ total }).eq("id", editingOrderId);
    await supabase.from("order_items").delete().eq("order_id", editingOrderId);
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
  }

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
    div.innerHTML = `
      <strong>فاتورة رقم ${order.invoice_no}</strong><br>
      ${order.total.toFixed(3)} د.ب<br>
      <button onclick="editOrder('${order.id}')">✏️ تعديل</button>
${order.is_paid 
  ? `<span style="color:green;font-weight:800;">✔ مدفوعة</span>`
  : `<button onclick="markPaid('${order.id}')">💰 تم الدفع</button>`
}
<button onclick="markCompleted('${order.id}')">✅ مكتمل</button>
<button onclick="deleteOrder('${order.id}')">🗑 حذف</button>
    `;
    box.appendChild(div);
  });
}

/* ✏️ تحميل الفاتورة للتعديل */
window.editOrder = async function (orderId) {
  editingOrderId = orderId;
  cart = [];

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

/* ✅ مكتمل */
window.markCompleted = async id => {
  await supabase.from("orders").update({
    status: "completed",
    closed_at: new Date().toISOString()
  }).eq("id", id);

  loadActiveOrders();
};
/* 💰 تم الدفع */
window.markPaid = async id => {
  await supabase.from("orders").update({
    is_paid: true,
    paid_at: new Date().toISOString()
  }).eq("id", id);

  loadActiveOrders();
};
/* 🗑 حذف */
window.deleteOrder = async id => {
  if (!confirm("حذف الفاتورة نهائيًا؟")) return;
  await supabase.from("order_items").delete().eq("order_id", id);
  await supabase.from("orders").delete().eq("id", id);
  loadActiveOrders();
};

/* ===============================
   NAV
================================ */
window.closeDay = () => location.href = "report.html";
window.goToReports = () => location.href = "reports.html";
window.goToSettings = () => location.href = "settings.html";



/* ===== طباعة الفاتورة ===== */


  window.printReceipt = function () {
  if (!cart.length) {
    alert("الفاتورة فارغة");
    return;
  }

  const receiptData = {
    items: cart,
    total: document.getElementById("total").textContent,
    paid: document.getElementById("paid").value || "—",
    change: document.getElementById("change").textContent,
    date: new Date().toLocaleString("ar-BH")
  };

  localStorage.setItem("receipt", JSON.stringify(receiptData));
  window.open("receipt.html", "_blank");
};
