
import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";
import { saveOfflineOrder, syncOfflineOrders } from "./offline.js";
window.setLang = setLang;

/*********************************
 * Get-Break | Cashier System
 *********************************/

let items = [];
let cart = [];
let activeOrders = [];
let currentBusinessDay = null;
let editingOrderId = null;
let currentInvoiceNo = null;
/* ===============================
   REALTIME – الطلبات الجارية
================================ */
function subscribeToOrders() {
  if (!currentBusinessDay) return; // حماية

  supabase
    .channel("orders-realtime")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "orders"
      },
      () => {
        if (!currentBusinessDay) return;
        loadActiveOrders();
      }
    )
    .subscribe();
}

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
/* ===============================
   INIT (OPTIMIZED)
================================ */
console.log("JS Loaded");
document.addEventListener("DOMContentLoaded", async () => {

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "login.html";
    return;
  }

  // 1️⃣ حمّل يوم العمل أولاً
  await loadCurrentDay();
  if (!currentBusinessDay) {
    alert("فشل تحميل يوم العمل");
    return;
  }

  // 2️⃣ حمّل البيانات
  loadItems("food");
  loadActiveOrders();

  // 3️⃣ بعدها فقط شغّل Realtime
  subscribeToOrders();

});

  document
    .getElementById("paid")
    ?.addEventListener("input", calculateChange);

  setInterval(loadActiveOrders, 60000);
});
window.addEventListener("online", async () => {
  await syncOfflineOrders(currentBusinessDay?.id);
  loadActiveOrders();
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
  extras: p.extras_list
    ? p.extras_list.split("\n").map(e => e.trim()).filter(Boolean)
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

  if (document.querySelector(".variant-overlay")) return;

  if (item.has_variants) {
    const { data: variants, error } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", item.id)
      .eq("active", true);

    if (error || !variants || variants.length === 0) {
      alert("لا توجد أحجام");
      return;
    }

    showVariantsPopup(item, variants);
    return;
  }

  if (Array.isArray(item.extras) && item.extras.length > 0) {
    showExtrasPopup(item);
    return;
  }

  addToCart({
    id: item.id,
    name: item.name,
    price: item.price
  });
}
function showVariantsPopup(item, variants) {
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

      <button class="variant-cancel">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();
  overlay.onclick = e => {
    if (e.target === overlay) overlay.remove();
  };
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
  variant_id: item.variant_id || null,
  extras_removed: unchecked
});

    overlay.remove();
  };
}


window.selectVariant = function (productId, name, variantId, label, price) {
  const baseItem = items.find(i => i.id === productId);

if (baseItem?.extras?.length) {
  showExtrasPopup({
    ...baseItem,
    name: `${name} (${label})`,
    price,
    variant_id: variantId
  });
} else {
  addToCart({
    id: productId,
    name: `${name} (${label})`,
    price,
    variant_id: variantId
  });
}
  document.querySelector(".variant-overlay")?.remove();
};

/* ===============================
   السلة
================================ */
function addToCart(item) {

  const existing = cart.find(i =>
    i.id === item.id &&
    i.variant_id === (item.variant_id || null) &&
    JSON.stringify(i.extras_removed || []) === JSON.stringify(item.extras_removed || [])
  );

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({
      row_id: crypto.randomUUID(),
      id: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      variant_id: item.variant_id || null,
      extras_removed: item.extras_removed || []
    });
  }

  renderCart();
}

/* ===============================
   استخراج الإضافات من الاسم
================================ */


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

let isSavingOrder = false; // 🔒 قفل الحفظ

window.completeOrder = async function () {

  // 🛑 منع الضغط المتكرر
  if (isSavingOrder) return;
  isSavingOrder = true;
  // 📴 إذا ما فيه إنترنت → حفظ محلي
  if (!navigator.onLine) {
    const offlineOrder = {
      offline_id: crypto.randomUUID(),
      cart: cart.map(i => ({
        product_id: i.id,
        variant_id: i.variant_id,
        item_name: i.name,
        qty: i.qty,
        price: i.price,
        extras_removed: i.extras_removed || []
      })),
      total: cart.reduce((s, i) => s + i.qty * i.price, 0),
      business_day_id: currentBusinessDay.id,
      created_at: new Date().toISOString(),
      is_paid: false
    };

    try {
      await saveOfflineOrder(offlineOrder);

      // تنظيف الواجهة

clearForNewOrder();
loadActiveOrders();

      alert("📦 تم حفظ الطلب محليًا (بدون إنترنت)");
    } catch (e) {
      alert("❌ فشل حفظ الطلب محليًا");
      console.error(e);
    }

    isSavingOrder = false;
    return;
  }
  // 🧺 الفاتورة فاضية
  if (!cart.length) {
    editingOrderId = null;
    isSavingOrder = false;
    return alert("الفاتورة فارغة");
  }

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  try {

    /* ===============================
       ✏️ تعديل طلب موجود
    ================================ */
    if (editingOrderId) {

  // تحديث الإجمالي
  await supabase
    .from("orders")
    .update({ total })
    .eq("id", editingOrderId);

  // 🔥 استبدال الأصناف بالكامل (آمن)
  await supabase.rpc("replace_order_items", {
    p_order_id: editingOrderId,
    p_items: cart.map(i => ({
      product_id: i.id,
      variant_id: i.variant_id,
      item_name: i.name,
      qty: i.qty,
      price: i.price,
      extras_removed: i.extras_removed || []
    }))
  });

  editingOrderId = null;
  loadActiveOrders(); // ✅ تحديث الطلبات الجارية فورًا
}
    /* ===============================
       🆕 طلب جديد
    ================================ */
    else {

      const { data: order, error } = await supabase
    .from("orders")
    .insert({
      total,
      status: "active",
      business_day_id: currentBusinessDay.id,
      timer_started_at: new Date().toISOString()
    })
    .select("id, invoice_no")
    .single();

  if (error || !order) {
    throw new Error("فشل إنشاء الطلب");
  }

  currentInvoiceNo = order.invoice_no;

  // إدخال الأصناف
  await supabase.from("order_items").insert(
    cart.map(i => ({
      order_id: order.id,
      product_id: i.id,
      variant_id: i.variant_id || null,
      item_name: i.name,
      qty: i.qty,
      price: i.price,
      extras_removed: i.extras_removed || []
    }))
  );

  // ✅ هذا المهم
  loadActiveOrders();   // 1
  clearForNewOrder();  // 2

} catch (err) {
  console.error(err);
  alert("❌ حصل خطأ أثناء حفظ الطلب");
} finally {
  isSavingOrder = false;
}

/* ===============================
   الطلبات الجارية
================================ */
async function loadActiveOrders() {
  if (!currentBusinessDay) return; // ✅ أهم سطر

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
  if (!box) return; // ✅ حماية مهمة جدًا

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

  // ✅ جلب رقم الفاتورة (مهم للطباعة)
  const { data: order } = await supabase
    .from("orders")
    .select("invoice_no")
    .eq("id", orderId)
    .single();

  currentInvoiceNo = order?.invoice_no || null;
  const { data } = await supabase
    .from("order_items")
    .select("qty, price, item_name, product_id, variant_id, extras_removed")
    .eq("order_id", orderId);

  if (!data || data.length === 0) {
    alert("⚠️ لا توجد أصناف حالياً، حاول مرة أخرى");
    return;
  }

  cart = data.map(i => ({
    row_id: crypto.randomUUID(), // 🔑 فريد لكل سطر
    id: i.product_id,
    name: i.item_name,
    price: i.price,
    qty: i.qty,
    variant_id: i.variant_id || null,
    extras_removed: i.extras_removed || []
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
   👁 عرض الفاتورة + طباعة
================================ */

window.viewOrder = async function (orderId) {
  const { data: items } = await supabase
    .from("order_items")
    .select("qty, price, item_name, extras_removed")
    .eq("order_id", orderId);

  if (!items || items.length === 0) {
    alert("لا توجد بيانات للفاتورة");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box" id="invoiceContent" style="max-width:500px">
      <h3>🧾 تفاصيل الفاتورة</h3>

      <div style="text-align:right;max-height:300px;overflow:auto">
        ${items.map(i => `
          <div style="border-bottom:1px dashed #ddd;padding:8px 0">
            <strong>${i.item_name}</strong>
            ${
              i.extras_removed?.length
                ? `<div style="font-size:13px;color:#555">
                     بدون: ${i.extras_removed.join("، ")}
                   </div>`
                : ""
            }
            الكمية: ${i.qty}<br>
            السعر: ${(i.price * i.qty).toFixed(3)} د.ب
          </div>
        `).join("")}
      </div>


      <button class="variant-cancel" style="margin-top:10px">إغلاق</button>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();
  overlay.onclick = e => {
    if (e.target === overlay) overlay.remove();
  };
};

/* ===============================
   NAV
================================ */
window.closeDay = () => location.href = "report.html";
window.goToReports = () => location.href = "reports.html";
window.goToSettings = () => location.href = "settings.html";
// ===============================
// تسجيل الخروج
// ===============================
window.logout = async function () {
  await supabase.auth.signOut();
  location.href = "login.html";
};
// ===============================
// طباعة الفاتورة
// ===============================
function clearForNewOrder() {
  cart = [];
  currentInvoiceNo = null;
  editingOrderId = null;
  renderCart();

  const paidInput = document.getElementById("paid");
  if (paidInput) paidInput.value = "";

  document.getElementById("change").textContent = "—";
}
window.printReceipt = function () {

  if (!cart.length) {
    alert("الفاتورة فارغة");
    return;
  }

  const invoiceNo = currentInvoiceNo || "—";

  const itemsHTML = cart.map(item => `
    <div class="item">
      <div class="name">${item.name}</div>
      <div class="qty">× ${item.qty}</div>
      ${
        item.extras_removed?.length
          ? `<div class="extras">بدون: ${item.extras_removed.join("، ")}</div>`
          : ""
      }
    </div>
  `).join("");

  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  const win = window.open("", "", "width=300,height=600");

  win.document.write(`
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>فاتورة</title>
<style>
  body {
    font-family: Arial, sans-serif;
    direction: rtl;
    text-align: center;
    padding: 10px;
  }
  h1 {
    font-size: 26px;
    margin: 10px 0 5px;
  }
  .invoice-no {
    font-size: 15px;
    margin-bottom: 10px;
  }
  hr {
    border: none;
    border-top: 1px dashed #000;
    margin: 10px 0;
  }
  .item {
    margin-bottom: 10px;
    text-align: right;
  }
  .name {
    font-size: 17px;
    font-weight: bold;
  }
  .qty {
    font-size: 15px;
    margin-right: 5px;
  }
  .extras {
    font-size: 14px;
    color: #444;
    margin-top: 3px;
  }
  .total {
    font-size: 20px;
    font-weight: bold;
    margin-top: 15px;
  }
</style>
</head>
<body>

<h1>خذلك بريك</h1>
<div class="invoice-no">فاتورة رقم: ${invoiceNo}</div>

<hr>

${itemsHTML}

<hr>

<div class="total">
  الإجمالي: ${total.toFixed(3)} د.ب
</div>

</body>
</html>
  `);

  win.document.close();
  win.focus();

  setTimeout(() => {
    win.print();
    win.close();
  }, 500);
};

// ===== MENU (FIX) =====
window.toggleMenu = function () {
  const menu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");
  if (!menu || !overlay) return;

  menu.classList.toggle("open");
  overlay.classList.toggle("show");
};

window.closeMenu = function () {
  document.getElementById("sideMenu")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("show");
};