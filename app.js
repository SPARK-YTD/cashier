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

  setInterval(loadActiveOrders, 60000); // 🔁 تحديث تلقائي كل دقيقة

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
const { data, error } = await supabase
  .from("products")
  .select("*")
  .eq("category", category)
  .eq("active", true);

if (error) {
  console.error(error);
  items = [];
  return;
}

items = data.map(p => ({
  ...p,
  extras: Array.isArray(p.extras)
    ? p.extras
    : p.extras
      ? p.extras.split(",").map(e => e.trim())
      : []
}));
  renderItems();
}
function cleanImageUrl(url) {
  if (!url) return "";
  return url
    .replace(/"/g, "")   // يشيل علامات الاقتباس
    .trim();             // يشيل المسافات
}
function renderItems() {
  const container = document.getElementById("items");
  if (!container) return;

  container.innerHTML = "";
  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
${item.image_url ? `<img src="${cleanImageUrl(item.image_url)}" class="cashier-item-img">` : ""}
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

  // 🚫 إذا فيه نافذة مفتوحة لا تفتح وحدة ثانية
  if (document.querySelector(".variant-overlay")) return;

 // 🟢 إذا عنده إضافات داخلية
if (Array.isArray(item.extras) && item.extras.length > 0) {
  showExtrasPopup(item);
  return;
}

  // 🟡 إذا ما عنده أحجام
  if (!item.has_variants) {
    addToCart({
      id: item.id,
      name: item.name,
      price: item.price
    });
    return;
  }

  // 🟠 إذا عنده أحجام
  const { data: variants, error } = await supabase
  .from("product_variants")
  .select("*")
  .eq("product_id", item.id)
  .eq("active", true);

if (error) {
  console.error(error);
  alert("حصل خطأ أثناء تحميل الأحجام");
  return;
}

if (!variants || variants.length === 0) {
  alert("لا توجد أحجام");
  return;
}

  showVariantsPopup(item, variants);
}
function showExtrasPopup(item) {
  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box">
      <h3>${item.name}</h3>

      <p style="font-size:14px;color:#555;margin-bottom:10px">
        اختر الإضافات التي لا يريدها الزبون
      </p>

      <div style="text-align:right;max-height:200px;overflow:auto">
${(Array.isArray(item.extras) ? item.extras : []).map(extra => `
  <label style="display:block;margin-bottom:6px">
    <input type="checkbox" value="${extra}" checked>
    ${extra}
  </label>
`).join("")}
      </div>

      <button class="variant-btn" id="confirmExtras">إضافة للسلة</button>
      <button class="variant-cancel">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);

  // زر الإلغاء
  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  // زر التأكيد
  overlay.querySelector("#confirmExtras").onclick = () => {
    const unchecked = [...overlay.querySelectorAll("input[type=checkbox]")]
      .filter(cb => !cb.checked)
      .map(cb => cb.value);

    let nameWithExtras = item.name;

    if (unchecked.length > 0) {
      nameWithExtras += ` (بدون: ${unchecked.join("، ")})`;
    }

    addToCart({
      id: item.id,
      name: nameWithExtras,
      price: item.price,
      extras_removed: unchecked
    });

    overlay.remove();
  };
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
  const extrasKey = item.extras_removed
    ? item.extras_removed.join("|")
    : "";

  const key = item.variant_id
    ? `${item.id}-${item.variant_id}-${extrasKey}`
    : `${item.id}-${extrasKey}`;

  const found = cart.find(i => i.key === key);

  if (found) {
    found.qty++;
  } else {
cart.push({
  ...item,
  variant_id: item.variant_id || null,
  extras_removed: item.extras_removed || [],
  key,
  qty: 1
});
  }

  renderCart();
}

/* ===============================
   استخراج الإضافات من الاسم
================================ */
function extractExtras(name) {
  const match = name.match(/\(بدون:\s*(.*?)\)/);
  if (!match) return [];
  return match[1].split("،").map(e => e.trim());
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

  // ✏️ إذا كنا نعدّل طلب
  if (editingOrderId) {

    await supabase
      .from("orders")
      .update({ total })
      .eq("id", editingOrderId);

    await supabase
      .from("order_items")
      .delete()
      .eq("order_id", editingOrderId);

    await supabase.from("order_items").insert(
      cart.map(i => ({
        order_id: editingOrderId,   // ✅ هنا
        product_id: i.id,
        variant_id: i.variant_id || null,
        item_name: i.name,
        qty: i.qty,
        price: i.price,
        extras_removed: i.extras_removed || []
      }))
    );

    editingOrderId = null;

  } 
  // 🆕 طلب جديد
  else {

    const { data: order } = await supabase
      .from("orders")
      .insert({
        total,
        status: "active",
        business_day_id: currentBusinessDay.id,
        timer_started_at: new Date().toISOString()
      })
      .select("id")
      .single();

    await supabase.from("order_items").insert(
      cart.map(i => ({
        order_id: order.id,        // ✅ هنا
        product_id: i.id,
        variant_id: i.variant_id || null,
        item_name: i.name,
        qty: i.qty,
        price: i.price,
        extras_removed: i.extras_removed || []
      }))
    );
  }

  // 🧹 تنظيف بعد الحفظ
  cart = [];
  renderCart();
  loadActiveOrders();

  const paidInput = document.getElementById("paid");
  if (paidInput) paidInput.value = "";
  document.getElementById("change").textContent = "—";
};

/* ===============================
   الطلبات الجارية
================================ */
async function loadActiveOrders() {
  const { data } = await supabase
  .from("orders")
  .select("id, total, invoice_no, created_at, timer_started_at, is_paid")
  .eq("status", "active")
  .eq("business_day_id", currentBusinessDay.id)
  .order("created_at", { ascending: false });
  activeOrders = data || [];
  renderActiveOrders();
}

function renderActiveOrders() {
  const box = document.getElementById("activeOrders");
  box.innerHTML = "";

  const now = Date.now();

  activeOrders.forEach(order => {
    const baseTime = order.timer_started_at || order.created_at;
const createdAt = new Date(baseTime).getTime();
    const diffMin = Math.floor((now - createdAt) / 60000);

    let bgColor = "";
    let borderColor = "";

    // 🟢 1) فاتورة جديدة جدًا (أقل من دقيقة) → بدون لون
    if (diffMin < 1) {
      bgColor = "";
      borderColor = "";
    }

    // 🔴 2) 20 دقيقة وأكثر
    else if (diffMin >= 20) {
      borderColor = "#DC2626";
      bgColor = order.is_paid
        ? "linear-gradient(90deg,#BBF7D0,#FECACA)" // مدفوعة + تأخير
        : "#FECACA";                               // غير مدفوعة
    }

    // 🟡 3) من 10 إلى 19 دقيقة
    else if (diffMin >= 10) {
      borderColor = "#FACC15";
      bgColor = order.is_paid
        ? "linear-gradient(90deg,#BBF7D0,#FDE68A)" // مدفوعة + تأخير
        : "#FDE68A";                               // غير مدفوعة
    }

    // 🟢 4) أقل من 10 دقائق ومدفوعة
    else if (order.is_paid) {
      bgColor = "#BBF7D0";
      borderColor = "#22C55E";
    }

    const div = document.createElement("div");
    div.className = "order-box";

    if (bgColor) div.style.background = bgColor;
    if (borderColor) div.style.borderLeft = `6px solid ${borderColor}`;

    div.innerHTML = `
      <strong>فاتورة رقم ${order.invoice_no}</strong><br>
      ${order.total.toFixed(3)} د.ب<br>
<button onclick="viewOrder('${order.id}')">👁 عرض الفاتورة</button>
      <button onclick="editOrder('${order.id}')">✏️ تعديل</button>

      ${
        order.is_paid
          ? `<span style="color:#166534;font-weight:800;">✔ مدفوعة</span>`
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
.select("qty, price, item_name, product_id, variant_id, extras_removed")
  .eq("order_id", orderId);

if (!data || data.length === 0) {
  alert("الفاتورة فارغة أو فيها خطأ");
  return;
}
  cart = data.map(i => {
const extras = i.extras_removed || [];
    const extrasKey = extras.join("|");

    const key = i.variant_id
      ? `${i.product_id}-${i.variant_id}-${extrasKey}`
      : `${i.product_id}-${extrasKey}`;

    return {
      id: i.product_id,
      name: i.item_name,
      price: i.price,
      qty: i.qty,
      variant_id: i.variant_id || null,
      extras_removed: extras,
      key
    };
  });

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
window.viewOrder = async function (orderId) {
  const { data: items } = await supabase
    .from("order_items")
.select("qty, price, item_name")
    .eq("order_id", orderId);

  if (!items || items.length === 0) {
    alert("لا توجد بيانات للفاتورة");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box" style="max-width:500px">
      <h3>🧾 تفاصيل الفاتورة</h3>

      <div style="text-align:right;max-height:300px;overflow:auto">
        ${items.map(i => `
          <div style="border-bottom:1px dashed #ddd;padding:8px 0">
<strong>${i.item_name}</strong>
            الكمية: ${i.qty}<br>
            السعر: ${(i.price * i.qty).toFixed(3)} د.ب
          </div>
        `).join("")}
      </div>

      <button class="variant-cancel" style="margin-top:10px">
        إغلاق
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // إغلاق
  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();
  overlay.onclick = e => {
    if (e.target === overlay) overlay.remove();
  };
};
