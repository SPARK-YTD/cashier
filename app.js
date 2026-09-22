import { supabase } from "./supabase.js";
import { saveOfflineOrder, syncOfflineOrders } from "./offline.js";
window.supabase = supabase;

  /*********************************
   * Get-Break | Cashier System
   *********************************/

  let items = [];
  let cart = [];
  let activeOrders = [];
  let currentBusinessDay = null;
  let editingOrderId = null;
  let currentInvoiceNo = null;
  let ordersChannel;
  let pendingOrdersChannel;
  let newOrdersChannel;
  window.DEBUG_CASHIER = true; // 🔴 DEBUG MODE
  let employeeMode = null;
  let deliveryMode = null;
  /* ===============================
     Business Day Helper
  ================================ */
async function getOrCreateBusinessDay() {
  // 1️⃣ حاول تجيب يوم مفتوح
  const { data: openDay, error } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("❌ Error fetching open day:", error);
    return null;
  }

  if (openDay) {
    console.log("🟢 Using existing open day:", openDay.id);
    return openDay;
  }

  // 2️⃣ إنشاء يوم جديد نظيف
  const today = new Date().toISOString().slice(0, 10);

  const { data: newDay, error: insertError } = await supabase
    .from("business_days")
    .insert({
      day_date: today,
      is_open: true,
      opened_at: new Date().toISOString(),
      invoice_counter: 0
    })
    .select()
    .single();

  if (insertError) {
    console.error("❌ Failed to create business day:", insertError);
    return null;
  }

  console.log("🆕 New clean business day created:", newDay.id);
  return newDay;
}
  
document.addEventListener("DOMContentLoaded", async () => {
  // 1️⃣ جلسة + يوم العمل أولاً
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    location.href = "login.html";
    return;
  }
  
  currentBusinessDay = await getOrCreateBusinessDay();
  if (!currentBusinessDay) {
    alert("❌ خطأ");
    return;
  }
  console.log("📅 Current Business Day:", currentBusinessDay);
  
  // 2️⃣ Event listeners
  window.addEventListener("online", async () => {
    console.log("🌐 Internet back → syncing...");
    await syncOfflineOrders(currentBusinessDay?.id);
    loadActiveOrders();
    subscribeToOrders();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      console.log("👀 Page visible → refresh orders");
      loadActiveOrders();
      subscribeToOrders();
    }
  });

  setInterval(() => {
    if (document.visibilityState === "visible") {
      loadActiveOrders();
    }
  }, 60000);
  
  // 3️⃣ حمّل البيانات
  renderCart();
  loadItems("food");       
  loadActiveOrders();    
  subscribeToOrders();
  subscribeToNewOrders();  // ✅ استقبل طلب جديد من QR Menu
  subscribeToPendingOrders();
  loadPendingOrders();

  setTimeout(() => {
    loadActiveOrders();
  }, 500);
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
    .eq("active", true)
    .order("sort_order", { ascending: true }); // 🔥 هذا السطر الناقص

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

  const ids = items.map(i => i.id);
  if (ids.length) {
    const { data: addonsData } = await supabase
      .from("product_addons")
      .select("*")
      .in("product_id", ids)
      .eq("active", true);

    items.forEach(item => {
      item.addons = addonsData?.filter(a => a.product_id === item.id) || [];
    });
  }

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
  
    if (
  (Array.isArray(item.extras) && item.extras.length > 0) ||
  (Array.isArray(item.addons) && item.addons.length > 0) ||
  item.is_spicy
) {
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
  
        ${item.extras?.length ? `
  <p style="font-size:14px;color:#555;margin-bottom:10px">
    اختر الإضافات التي لا يريدها الزبون
  </p>

  <div style="text-align:right;max-height:200px;overflow:auto">
    ${item.extras.map(extra => `
      <label style="display:block;margin-bottom:6px">
        <input type="checkbox" value="${extra}" checked>
        ${extra}
      </label>
    `).join("")}
  </div>
` : ""}

  ${item.addons?.length ? `
  <hr style="margin:10px 0">
  <p style="font-size:14px;color:#555;margin-bottom:10px">
    إضافات مدفوعة
  </p>

  <div style="text-align:right;max-height:200px;overflow:auto">
    ${item.addons.map(a => `
      <label style="display:block;margin-bottom:6px">
        <input type="checkbox" class="addon-checkbox" value="${a.id}" data-name="${a.name}" data-price="${a.price}">
        ${a.name} (+${Number(a.price).toFixed(3)} د.ب)
      </label>
    `).join("")}
  </div>
` : ""}

   ${item.is_spicy ? `
  <hr style="margin:10px 0">

  <label style="display:block;font-weight:700">
    <input type="checkbox" id="spicyOption">
    🌶️ سبايسي
  </label>
` : ""}
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
  .filter(cb => cb.id !== "spicyOption" && !cb.classList.contains("addon-checkbox") && !cb.checked)
  .map(cb => cb.value);

const selectedAddons = [...overlay.querySelectorAll(".addon-checkbox:checked")]
  .map(cb => ({
    id: cb.value,
    name: cb.dataset.name,
    price: Number(cb.dataset.price)
  }));

const isSpicy =
  overlay.querySelector("#spicyOption")?.checked || false;

let nameWithExtras = item.name;

// 🌶️ فقط إذا سبايسي
if (isSpicy) {
  nameWithExtras += " 🌶 سبايسي";
}

// ❌ الإضافات فقط
if (unchecked.length > 0) {
  nameWithExtras += ` (بدون: ${unchecked.join("، ")})`;
}

// ➕ الإضافات المدفوعة
if (selectedAddons.length > 0) {
  nameWithExtras += ` (+ ${selectedAddons.map(a => a.name).join("، ")})`;
}

const addonsTotal = selectedAddons.reduce((s, a) => s + a.price, 0);

addToCart({
  id: item.id,
  name: nameWithExtras,
  price: item.price + addonsTotal,
  variant_id: item.variant_id || null,
  extras_removed: unchecked,
  is_spicy: isSpicy,
  addons: selectedAddons
});

      overlay.remove();
    };
  }
  
  window.selectVariant = function (productId, name, variantId, label, price) {
  const baseItem = items.find(i => i.id === productId);

  if (
    (baseItem?.extras?.length > 0) ||
    (baseItem?.addons?.length > 0) ||
    baseItem?.is_spicy
  ) {
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
      variant_id: variantId,
      addons: []
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
  i.is_spicy === (item.is_spicy || false) &&
  JSON.stringify(i.extras_removed || []) === JSON.stringify(item.extras_removed || []) &&
  JSON.stringify((i.addons || []).map(a => a.id)) === JSON.stringify((item.addons || []).map(a => a.id))
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
  extras_removed: item.extras_removed || [],
  is_spicy: item.is_spicy || false,
  addons: item.addons || []
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
     إتمام الطلب (جديد / تعديل)
  ================================ */
  
  let isSavingOrder = false; // 🔒 قفل الحفظ
  
  window.addEventListener("beforeunload", (e) => {
    if (isSavingOrder) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  
  window.completeOrder = async function () {
  
    // 🛑 منع الضغط المتكرر
    if (isSavingOrder) return;
    isSavingOrder = true;
  const completeBtn = document.getElementById("completeOrderBtn");
  if (completeBtn) completeBtn.disabled = true;
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
          extras_removed: i.extras_removed || [],
          addons: i.addons || []
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
  
  if (completeBtn) completeBtn.disabled = false;
  isSavingOrder = false;
      return;
    }
    // 🧺 الفاتورة فاضية
    if (!cart.length) {
    editingOrderId = null;
    if (completeBtn) completeBtn.disabled = false;
    isSavingOrder = false;
    return alert("الفاتورة فارغة");
  }
  
    const total = cart.reduce((s, i) => s + i.qty * i.price, 0);
  // ❌ منع تجاوز رصيد الموظف
  if (employeeMode && total > employeeMode.remaining) {
    alert("❌ المبلغ يتجاوز رصيد الموظف");
    if (completeBtn) completeBtn.disabled = false;
    isSavingOrder = false;
    return;
  }
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
        extras_removed: i.extras_removed || [],
        addons: i.addons || []
      }))
    });
  
    editingOrderId = null;
    loadActiveOrders(); // ✅ تحديث الطلبات الجارية فورًا
  }
      /* ===============================
         🆕 طلب جديد
      ================================ */
      else {
  
// 1️⃣ زيادة رقم الفاتورة بشكل آمن من قاعدة البيانات
const { data: invoiceNo, error: rpcError } = await supabase
  .rpc("increment_invoice_counter", { row_id: currentBusinessDay.id });
  
if (rpcError) {
  console.error("RPC ERROR:", rpcError);
  alert("❌ فشل توليد رقم الفاتورة");
  isSavingOrder = false;
  if (completeBtn) completeBtn.disabled = false;
  return;
}

if (!Number.isInteger(invoiceNo)) {
  alert("❌ رقم الفاتورة غير صالح");
  isSavingOrder = false;
  if (completeBtn) completeBtn.disabled = false;
  return;
}

  
  // 2️⃣ إنشاء الطلب برقم الفاتورة الجديد
// ===============================
// 🚚 سؤال: هل الطلب توصيل؟
// ===============================
if (!employeeMode && !deliveryMode) {
  const isDelivery = confirm("هل الطلب توصيل؟");

  if (isDelivery) {
    const name = prompt("اسم العميل:");
    if (!name) {
      isSavingOrder = false;
      if (completeBtn) completeBtn.disabled = false;
      return;
    }

    const phone = prompt("رقم التلفون:");
    if (!phone) {
      isSavingOrder = false;
      if (completeBtn) completeBtn.disabled = false;
      return;
    }

    const area = prompt("المنطقة:");
    if (!area) {
      isSavingOrder = false;
      if (completeBtn) completeBtn.disabled = false;
      return;
    }

    deliveryMode = { name, phone, area };
  }
}

// ===============================
// إنشاء الطلب
// ===============================
const { data: order, error } = await supabase
  .from("orders")
  .insert({
    total,
    status: "active",
    business_day_id: currentBusinessDay.id,
    invoice_no: invoiceNo,
    timer_started_at: new Date().toISOString(),

    // 👨‍🍳 موظف
    is_employee_order: employeeMode ? true : false,
    employee_code: employeeMode ? employeeMode.employee_code : null,

    // 💰 دفع تلقائي للموظف
    is_paid: employeeMode ? true : false,
    payment_method: employeeMode ? "employee" : null,

    // 🚚 توصيل
    is_delivery: deliveryMode ? true : false,
    customer_name: deliveryMode?.name || null,
    customer_phone: deliveryMode?.phone || null,
    customer_area: deliveryMode?.area || null
  })
  .select("id, invoice_no")
  .single();
  
  if (error) {
    alert("❌ فشل إنشاء الطلب");
    if (completeBtn) completeBtn.disabled = false;
    isSavingOrder = false;
    return;
  }
  
  // 3️⃣ تخزين رقم الفاتورة للاستخدام (عرض / طباعة)
  
  // 4️⃣ تحديث اليوم الحالي بالواجهة
  currentBusinessDay.invoice_counter = invoiceNo;
  
  currentInvoiceNo = order.invoice_no;
  
        if (error || !order) {
          throw new Error("فشل إنشاء الطلب");
        }
  
               await supabase.from("order_items").insert(
          cart.map(i => ({
            order_id: order.id,
            product_id: i.id,
            variant_id: i.variant_id || null,
            item_name: i.name,
            qty: i.qty,
            price: i.price,
            extras_removed: i.extras_removed || [],
            addons: i.addons || []
          }))
        );
      }
       await loadActiveOrders(); // ✅ تحديث فوري للطلبات الجارية
  // خصم رصيد الموظف + الخروج من الوضع
  if (employeeMode) {
  const { data: success } = await supabase.rpc(
    "deduct_employee_balance",
    {
      p_employee_id: employeeMode.employee_id,
      p_amount: total
    }
  );

  if (!success) {
    alert("❌ فشل خصم الرصيد");
    isSavingOrder = false;
    if (completeBtn) completeBtn.disabled = false;
    return;
  }

  employeeMode = null;

  document.body.classList.remove("employee-mode"); // ✅ هذا السطر المهم

  const banner = document.getElementById("employeeBanner");
  if (banner) banner.style.display = "none";
}
       deliveryMode = null;
       clearForNewOrder();
      /* ===============================
         🧹 تنظيف بعد الحفظ
      ================================ */
  
    } catch (err) {
      console.error(err);
      alert("❌ حصل خطأ أثناء حفظ الطلب");
    }
  
  
  // 🔓 فتح القفل
  if (completeBtn) completeBtn.disabled = false;
  isSavingOrder = false;
  };
  
  /* ===============================
     REALTIME – الطلبات الجارية
  ================================ */
  function subscribeToOrders() {
    if (ordersChannel) {
      supabase.removeChannel(ordersChannel);
    }
  
    ordersChannel = supabase
      .channel("orders-cashier-realtime")
  
      // 🟢 طلب جديد
      .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "orders" },
    (payload) => {
      console.log("🟢 NEW ORDER DETECTED:", payload.new);
      // إعادة تحميل كاملة لضمان البيانات الصحيحة مع الـ relations
      loadActiveOrders();
    }
  )
  
      // 🟡 تحديث الطلب (جاهز / مدفوع / مكتمل)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          console.log("🟡 UPDATE ORDER:", payload.new);
  
          const index = activeOrders.findIndex(
            o => o.id === payload.new.id
          );
  
          if (index !== -1) {
            activeOrders[index] = payload.new;
            renderActiveOrders();
          }
        }
      )
  
      .subscribe((status) => {
        console.log("🔵 CHANNEL STATUS:", status);
      });
  }
  
  /* ===============================
   PENDING ORDERS - Subscription
================================ */

function subscribeToPendingOrders() {
  if (window.DEBUG_CASHIER) console.log("🔴 SUBSCRIBING TO PENDING ORDERS...");

  if (pendingOrdersChannel) {
    supabase.removeChannel(pendingOrdersChannel);
  }

  pendingOrdersChannel = supabase
    .channel("pending-orders-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "pending_orders" },
      (payload) => {
        if (window.DEBUG_CASHIER) {
          console.log("🟠 INSERT EVENT RECEIVED:", payload);
          console.log("🟠 ORDER ITEMS:", payload.new.order_items);
          console.log("🟠 ITEMS TYPE:", typeof payload.new.order_items);
          console.log("🟠 IS ARRAY?:", Array.isArray(payload.new.order_items));
        }
        showPendingOrderModal(payload.new);
      }
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "pending_orders" },
      (payload) => {
        if (window.DEBUG_CASHIER) console.log("🟡 PENDING ORDER UPDATED:", payload.new.status);
        const modal = document.getElementById(`pending-modal-${payload.new.id}`);
        if (modal) modal.remove();
      }
    )
    .subscribe((status) => {
      if (window.DEBUG_CASHIER) console.log("🔵 PENDING ORDERS CHANNEL STATUS:", status);
    });
}

function subscribeToNewOrders() {
  if (window.DEBUG_CASHIER) console.log("🟢 SUBSCRIBING TO NEW ORDERS...");

  if (newOrdersChannel) {
    supabase.removeChannel(newOrdersChannel);
  }

  newOrdersChannel = supabase
    .channel("new-orders-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "orders" },
      (payload) => {
        if (window.DEBUG_CASHIER) console.log("🟢 NEW ORDER ADDED TO ORDERS:", payload.new);
        loadActiveOrders();  // تحديث فوراً
      }
    )
    .subscribe((status) => {
      console.log("🟢 ORDERS SUBSCRIPTION STATUS:", status);
    });
}

function showPendingOrderModal(order) {
  if (window.DEBUG_CASHIER) {
    console.log("%c🔔 showPendingOrderModal() CALLED", "background:#222;color:#0f0;font-size:14px;padding:4px");
    console.log("🔍 FULL ORDER OBJECT:", order);
    console.log("🔍 order.order_items RAW:", order.order_items);
    console.log("🔍 typeof order.order_items:", typeof order.order_items);
  }
  
  // ✅ Safe check - إذا order_items null أو undefined
  const items = order.order_items || [];
  if (!Array.isArray(items)) {
    console.error("❌ order_items ليست array:", items);
    return;
  }
  if (window.DEBUG_CASHIER) console.log("🔍 items.length:", items.length);
  
  const itemsHtml = items.map(i => {
    const variant = i.variant ? (i.variant.label || i.variant.id) : '';
    const displayName = variant ? `${(i.productName || '').split(' - ')[0]} - ${variant}` : (i.productName || 'صنف');
    return `
    <div style="background: #f5f5f5; padding: 10px; margin-bottom: 8px; border-radius: 6px; border-right: 3px solid #D4A574;">
      <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">
        🔹 ${displayName} ×${i.qty} = ${parseFloat(i.price || 0).toFixed(3)} د.ب
      </div>
      ${i.addons && i.addons.length ? `<div style="font-size: 12px; color: #10B981; margin-left: 12px;">➕ ${i.addons.map(a => a.name).join(', ')}</div>` : ''}
      ${i.extras_removed && i.extras_removed.length ? `<div style="font-size: 12px; color: #DC2626; margin-left: 12px;">❌ بدون: ${i.extras_removed.join(', ')}</div>` : ''}
      ${i.is_spicy ? `<div style="font-size: 12px; color: #D97706; margin-left: 12px;">🌶️ سبايسي</div>` : ''}
    </div>
  `;
  }).join('');

  const modal = document.createElement('div');
  modal.id = `pending-modal-${order.id}`;
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7); z-index: 99999; display: flex;
    align-items: center; justify-content: center;
  `;

  modal.innerHTML = `
    <div style="background: white; border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
      <h2 style="margin-top: 0; color: #111827; text-align: center;">📋 طلب جديد معلق!</h2>
      
      <div style="background: #fff3cd; padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: center; font-weight: 600; color: #856404;">
        ⚠️ ينتظر الموافقة
      </div>

      <div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
        <p><strong>👤 الاسم:</strong> ${order.customer_name || 'عميل'}</p>
        <p><strong>📱 الرقم:</strong> ${order.customer_phone}</p>
        <p><strong>🏪 النوع:</strong> ${order.delivery_type === 'pickup' ? '🚶 استقبال من المحل' : '🚗 توصيل'}</p>
        ${order.delivery_type === 'delivery' ? `<p><strong>📍 المنطقة:</strong> ${order.delivery_area || 'N/A'}</p><p><strong>🏠 العنوان:</strong> ${order.delivery_address || 'N/A'}</p>` : ''}
        ${order.notes ? `<p><strong>📝 ملاحظات:</strong> ${order.notes}</p>` : ''}
      </div>

      <div style="background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 16px; max-height: 200px; overflow-y: auto;">
        <strong>📦 الأصناف:</strong>
        ${itemsHtml || '<div style="color: #999; padding: 8px;">لا توجد أصناف</div>'}
      </div>

      <div style="background: #e8f5e9; padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: center; font-weight: 700; font-size: 16px; color: #2e7d32;">
        💰 الإجمالي: ${parseFloat(order.total_price || 0).toFixed(3)} د.ب
      </div>

      <div style="display: flex; gap: 10px;">
        <button onclick="approvePendingOrder('${order.id}')" style="flex: 1; background: #10B981; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 14px;">
          ✅ قبول
        </button>
        <button onclick="rejectPendingOrder('${order.id}')" style="flex: 1; background: #EF4444; color: white; border: none; padding: 12px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 14px;">
          ❌ رفض
        </button>
      </div>

      <p style="text-align: center; font-size: 12px; color: #6B7280; margin-top: 12px;">
        ⏰ ${new Date(order.created_at).toLocaleTimeString('ar-EG')}
      </p>
    </div>
  `;

  document.body.appendChild(modal);
  
  if (window.DEBUG_CASHIER) {
    console.log("%c✅ MODAL APPENDED TO DOM", "background:#222;color:#0f0;font-size:14px;padding:4px");
    console.log("🔍 modal element in DOM?", !!document.getElementById(`pending-modal-${order.id}`));
  }
  
  setTimeout(() => {
    try {
      playNotificationSound();
    } catch (e) {
      console.log("Sound error:", e);
    }
  }, 100);
}
  
async function loadPendingOrders() {
  try {
    const { data, error } = await supabase
      .from("pending_orders")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    if (data && data.length > 0) {
      console.log("📋 Found pending orders:", data.length);
      data.forEach(order => {
        console.log("🟠 EXISTING PENDING ORDER:", order);
        showPendingOrderModal(order);
           });
      
      await new Promise(resolve => setTimeout(resolve, 500));
      loadActiveOrders();
    }
    
  } catch (error) {
    console.error("Error loading pending orders:", error);
  }
}

window.approvePendingOrder = async function(orderId) {
  try {
    const { data: order, error: fetchError } = await supabase
      .from("pending_orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchError) throw fetchError;

    console.log("🔍 PENDING ORDER DATA:", JSON.stringify(order, null, 2));
    console.log("🔍 ORDER_ITEMS:", order.order_items);

    // ✅ Insert في orders مع كل البيانات
    const orderData = {
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      order_items: order.order_items,   
      total: order.total_price,
      is_delivery: order.delivery_type === 'delivery',
      customer_area: order.delivery_area,
      status: "pending", 
      business_day_id: currentBusinessDay.id,
      kitchen_ready: false,
      is_completed: false,
      is_paid: false,
      source: 'qr_menu',
      created_at: new Date().toISOString()
    };
    
    // إضافة delivery_address إذا كانت موجودة في جدول orders
    if (order.delivery_address) {
      orderData.customer_address = order.delivery_address;
    }
    
    const { data: newOrder, error: insertError } = await supabase
      .from("orders")
      .insert([orderData])
      .select();

    if (insertError) throw insertError;

    console.log("✅ NEW ORDER CREATED:", newOrder);

    // ✅ حدّث pending_orders إلى approved + نمرر رقم الفاتورة عشان تنبعث للعميل عبر Realtime
    const createdOrder = newOrder && newOrder[0] ? newOrder[0] : null;

    await supabase
      .from("pending_orders")
      .update({
        status: "approved",
        linked_invoice_no: createdOrder && createdOrder.invoice_no != null ? String(createdOrder.invoice_no) : null,
        linked_order_id: createdOrder ? createdOrder.id : null
      })
      .eq("id", orderId);

    // ✅ احذف المودال فوراً
    const modal = document.getElementById(`pending-modal-${orderId}`);
    if (modal) modal.remove();

    // ✅ حدّث الطلبات الجارية فوراً (ما تنتظر timeout)
    loadActiveOrders();  // إعادة تحميل فورية
    
    // حدّث subscriptions بعد تأخير قليل
    setTimeout(() => {
      subscribeToOrders();
    }, 300);

    const successMsg = `✅ تم قبول طلب ${order.customer_name || 'العميل'}\n📱 الرقم: ${order.customer_phone}\n💰 المبلغ: ${parseFloat(order.total_price || 0).toFixed(3)} د.ب`;
    alert(successMsg);
    
  } catch (error) {
    console.error("Error approving order:", error);
    alert("❌ خطأ: " + error.message);
  }
};

window.rejectPendingOrder = async function(orderId) {
  try {
    // حذف من pending_orders
    const { error } = await supabase
      .from("pending_orders")
      .update({ status: "rejected" })
      .eq("id", orderId);

    if (error) throw error;

    // احذف الـ modal
    const modal = document.getElementById(`pending-modal-${orderId}`);
    if (modal) modal.remove();

    alert("❌ تم رفض الطلب");
    
  } catch (error) {
    console.error("Error rejecting order:", error);
    alert("❌ خطأ: " + error.message);
  }
}

function playNotificationSound() {
  // استخدم صوت النظام أو جرب هذا:
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.value = 800;
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

  
  /* ===============================
     الطلبات الجارية
  ================================ */
  async function loadActiveOrders() {
    const { data } = await supabase
  .from("orders")
  .select(`
  id,
  total,
  invoice_no,
  created_at,
  timer_started_at,
  is_paid,
  payment_method,
  cash_amount,
  benefit_amount,
  kitchen_ready,
  is_employee_order,
  employee_code,
  is_delivery,
  customer_name,
  customer_phone,
  customer_area,
  order_items,
  source,
  employees:employees!orders_employee_code_fkey(name)
`)
  .in("status", ["pending", "active"])
  .eq("business_day_id", currentBusinessDay.id)
  .order("created_at", { ascending: false });
  
    activeOrders = data || [];
    renderActiveOrders();
  }
  
  function renderActiveOrders() {
    
    const box = document.getElementById("activeOrders");
    box.innerHTML = "";

    console.log("📊 RENDERING ORDERS:", activeOrders);
  
    const now = Date.now();
  
    activeOrders.forEach((order, idx) => {
      console.log(`📦 Order ${idx}:`, order);
      console.log(`📦 Order ${idx} order_items:`, order.order_items);
      
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
  <strong>فاتورة رقم ${order.invoice_no || "—"}</strong>
  <br>
  ${
    order.is_delivery
      ? `
        <div style="
          background:#EFF6FF;
          border:2px dashed #2563EB;
          padding:8px;
          border-radius:8px;
          margin:8px 0;
          font-size:13px;
        ">
          <div style="font-weight:900;color:#2563EB">🚚 طلب توصيل</div>
          <div>👤 ${order.customer_name || "—"}</div>
          <div>📞 ${order.customer_phone || "—"}</div>
          <div>📍 ${order.customer_area || "—"}</div>
          ${order.customer_address ? `<div>🏠 ${order.customer_address}</div>` : ""}
        </div>
      `
      : order.source === 'qr_menu' ? `
        <div style="
          background:#DCFCE7;
          border:2px dashed #22C55E;
          padding:8px;
          border-radius:8px;
          margin:8px 0;
          font-size:13px;
        ">
          <div style="font-weight:900;color:#22C55E">🚶 استقبال من المحل</div>
          <div>👤 ${order.customer_name || "—"}</div>
          <div>📞 ${order.customer_phone || "—"}</div>
        </div>
      ` : ""
  }

  ${order.order_items && Array.isArray(order.order_items) && order.order_items.length > 0 ? `
    <div style="border-top: 1px solid #ddd; margin-top: 8px; padding-top: 8px; font-size: 12px;">
      <strong>📦 الأصناف:</strong>
      ${order.order_items.map((item, itemIdx) => {
        console.log(`    Item ${itemIdx}:`, item);
        return `
        <div style="margin: 4px 0;">
          🔹 ${item.productName || item.name || "صنف"} ×${item.qty} = ${parseFloat(item.price || 0).toFixed(3)} د.ب
          ${item.addons && item.addons.length ? `
            <div style="margin-left: 12px; font-size: 11px; color: #666;">
              ➕ ${item.addons.map(a => a.name).join(", ")}
            </div>
          ` : ""}
          ${item.extras_removed && item.extras_removed.length ? `
            <div style="margin-left: 12px; font-size: 11px; color: #d64545;">
              ❌ بدون: ${item.extras_removed.join(", ")}
            </div>
          ` : ""}
          ${item.is_spicy ? `
            <div style="margin-left: 12px; font-size: 11px; color: #d97706;">
              🌶️ سبايسي
            </div>
          ` : ""}
        </div>
      `;
      }).join("")}
    </div>
  ` : `
    <div style="background: #FEE2E2; padding: 8px; border-radius: 4px; margin-top: 8px; color: #DC2626; font-size: 12px;">
      ⚠️ لا توجد بيانات للفاتورة
    </div>
  `}

  ${
    order.is_employee_order
      ? `
        <div style="color:#7c3aed;font-weight:900">🧑‍🍳 طلب موظف</div>
        <div style="font-size:13px;margin-top:4px">
          ${order.employees?.name || "—"}
          (ID: ${order.employee_code || "—"})
        </div>
        <div style="color:#16a34a;font-weight:800;margin-top:6px">
          ✔ مدفوع
        </div>
        <button onclick="markEmployeeDone('${order.id}')" style="margin-top:8px;background:#7c3aed;color:white;border:none;padding:6px 10px;border-radius:6px;font-weight:700;cursor:pointer;">
          ✅ مكتمل
        </button>
      `
      : order.kitchen_ready
        ? `<div style="color:#16a34a;font-weight:800">🟢 جاهز</div>`
        : `<div style="color:#facc15;font-weight:700">⏳ قيد التحضير</div>`
  }

  ${parseFloat(order.total || 0).toFixed(3)} د.ب<br>

  ${
    order.is_employee_order
      ? ""
      : `
        <button onclick="viewOrder('${order.id}')">👁 عرض الفاتورة</button>
        <button onclick="editOrder('${order.id}')">✏️ تعديل</button>
        ${
          order.is_paid
            ? `
              <div style="color:#166534;font-weight:800;">
                ✔ مدفوعة
              </div>
              <div style="font-size:13px;margin-top:4px;color:#444">
                💵 كاش: ${(order.cash_amount || 0).toFixed(3)} د.ب<br>
                💳 بطاقة: ${(order.benefit_amount || 0).toFixed(3)} د.ب
              </div>
            `
            : `<button onclick="markPaid('${order.id}')">💰 تم الدفع</button>`
        }
        <button onclick="markCompleted('${order.id}')">✅ مكتمل</button>
        <button onclick="deleteOrder('${order.id}')">🗑 حذف</button>
      `
  }
`;
      box.appendChild(div);
    });
  }
  // ✅ إخفاء طلب الموظف من الجارية
  window.markEmployeeDone = async function (orderId) {
    await supabase
      .from("orders")
      .update({
        status: "completed",
        kitchen_ready: true
      })
      .eq("id", orderId);
    await deductConsumables(orderId);
    await loadActiveOrders();
  };
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
      .select("qty, price, item_name, product_id, variant_id, extras_removed, addons")
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
      extras_removed: i.extras_removed || [],
      addons: i.addons || []
    }));
  
    renderCart();
  };
  
  /* ✅ مكتمل (اختيار طريقة الدفع) */
window.markCompleted = async function (orderId) {
  const order = activeOrders.find(o => o.id === orderId);
  if (!order) return;

  if (!order.is_paid) {
    alert("❌ لا يمكن إقفال الفاتورة بدون تسجيل الدفع");
    return;
  }

  try {
    const { data: freshOrder, error } = await supabase
      .from("orders")
      .select("total, cash_amount, benefit_amount, status")
      .eq("id", orderId)
      .single();

    if (error || !freshOrder) {
      alert("❌ تعذر التحقق من بيانات الدفع");
      return;
    }

    const paidSum =
      Number(freshOrder.cash_amount || 0) +
      Number(freshOrder.benefit_amount || 0);

    if (Math.abs(paidSum - Number(freshOrder.total)) > 0.001) {
      alert("❌ مبلغ الدفع لا يساوي إجمالي الفاتورة");
      return;
    }

    // 🛑 إذا كان الطلب مكتمل مسبقًا لا نعيد التحديث
    if (freshOrder.status === "completed") {
      alert("✔ الفاتورة مقفلة مسبقًا");
      return;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({
        status: "completed",
        closed_at: new Date().toISOString(),
        kitchen_ready: true
      })
      .eq("id", orderId);
    

    if (updateError) {
      console.error(updateError);
      alert("❌ قاعدة البيانات رفضت الإقفال");
      return;
    }
    await deductConsumables(orderId);
    await processEmployeePayout(orderId);
    await loadActiveOrders();

  } catch (err) {
    console.error(err);
    alert("❌ حصل خطأ أثناء إقفال الفاتورة");
  }
};
// 💰 فتح واجهة اختيار طريقة الدفع

window.markPaid = function (orderId) {
  if (document.querySelector(".variant-overlay")) return;

  const order = activeOrders.find(o => o.id === orderId);
  if (!order) return;

  if (order.is_paid) {
    alert("⚠️ الفاتورة مسجلة كمدفوعة");
    return;
  }

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box" style="max-width:340px">
      <h3>طريقة الدفع</h3>

      <button class="variant-btn"
        onclick="openUnifiedPay('${orderId}', ${order.total})">
        💰 تسجيل الدفع
      </button>

      <button class="variant-cancel">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);
  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();
};

window.openUnifiedPay = function (orderId, total) {
  document.querySelector(".variant-overlay")?.remove();

  let cash = 0;
  let benefit = 0;
  let receivedCash = 0;
  let mode = "cash";

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box" style="max-width:380px">
      <h3>💰 تسجيل الدفع</h3>

      <div style="font-weight:800;margin-bottom:6px">
        الإجمالي: ${total.toFixed(3)} د.ب
      </div>

      <div style="display:flex;gap:6px;margin-bottom:10px">
        <button id="tabCash" class="variant-btn">💵 كاش</button>
        <button id="tabBenefit" class="variant-btn secondary">💳 بنفت</button>
      </div>

      <div id="payBody"></div>
      <div id="payError" style="color:#dc2626;margin-top:6px"></div>

      <button class="variant-btn" id="confirmPay">✅ تأكيد الدفع</button>
      <button class="variant-cancel">إلغاء</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const payBody = overlay.querySelector("#payBody");
  const errorEl = overlay.querySelector("#payError");

function render() {
  const remaining = total - cash - benefit;
  const change =
    mode === "cash" && Number(receivedCash) > cash
      ? Number(receivedCash) - cash
      : 0;

  payBody.innerHTML = `
    <label>${mode === "cash" ? "💵 مبلغ الكاش" : "💳 مبلغ البنفت"}</label>

    <input
      type="text"
      inputmode="decimal"
      pattern="[0-9]*[.,]?[0-9]*"
      placeholder="0.000"
      value="${mode === "cash" ? receivedCash : benefit}"
      id="payInput"
    />

    ${
      mode === "benefit" && cash > 0
        ? `<div style="font-size:13px;color:#16a34a;margin-top:4px">
            💵 مدفوع كاش: ${cash.toFixed(3)} د.ب
          </div>`
        : ""
    }

    ${
      mode === "benefit"
        ? `
          <button id="fillRemaining" style="
            margin-top:6px;
            width:100%;
            background:#16a34a;
            color:white;
            border:none;
            padding:6px;
            border-radius:6px;
            font-weight:700;
          ">
            💳 تعبئة المبلغ المتبقي
          </button>
        `
        : ""
    }

    ${
  mode === "cash"
    ? `
      <div class="cash-buttons" style="
        display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:6px;
        margin-top:8px
      ">
        <button data-val="0.050">0.050</button>
        <button data-val="0.100">0.100</button>
        <button data-val="0.500">0.500</button>
        <button data-val="1">1</button>
        <button data-val="5">5</button>
        <button data-val="10">10</button>
        <button data-val="20">20</button>
      </div>

      <button id="fillCashRemaining" style="
        margin-top:6px;
        width:100%;
        background:#2563eb;
        color:white;
        border:none;
        padding:6px;
        border-radius:6px;
        font-weight:700;
      ">
        💵 تعبئة المبلغ المتبقي
      </button>
    `
    : ""
}

    <div class="remaining" style="margin-top:6px;font-weight:700">
      المتبقي: ${remaining.toFixed(3)} د.ب
      ${
        change > 0
          ? `<br><span style="color:#16a34a">
              💰 الباقي للزبون: ${change.toFixed(3)} د.ب
            </span>`
          : ""
      }
    </div>
  `;

  const input = payBody.querySelector("#payInput");
  input.focus();
  input.setSelectionRange?.(input.value.length, input.value.length);

  input.oninput = e => {
    const raw = e.target.value.replace(",", ".");

    if (raw.includes(".")) {
      const [, dec] = raw.split(".");
      if (dec.length > 3) return;
    }

    if (raw === "" || raw === "." || raw === "0.") {
      if (mode === "cash") {
        receivedCash = raw;
        cash = 0;
      } else {
        benefit = 0;
      }
      errorEl.textContent = "";
      return;
    }

    const v = parseFloat(raw);
    if (isNaN(v)) return;

    if (mode === "cash") {
      receivedCash = raw;
      cash = Math.min(v, total - benefit);
    } else {
      benefit = v;
    }

    if (cash + benefit > total && mode !== "cash") {
      errorEl.textContent = "❌ المبلغ أكبر من الإجمالي";
    } else {
      errorEl.textContent = "";
    }

    const remainingEl = payBody.querySelector(".remaining");
    const liveChange =
      mode === "cash" && Number(receivedCash) > cash
        ? Number(receivedCash) - cash
        : 0;

    if (remainingEl) {
      remainingEl.innerHTML = `
        المتبقي: ${(total - cash - benefit).toFixed(3)} د.ب
        ${
          liveChange > 0
            ? `<br><span style="color:#16a34a">
                💰 الباقي للزبون: ${liveChange.toFixed(3)} د.ب
              </span>`
            : ""
        }
      `;
    }
  };

  payBody.querySelectorAll(".cash-buttons button").forEach(btn => {
    btn.onclick = () => {
      const add = Number(btn.dataset.val);
      const current = Number(receivedCash || 0);
      const next = +(current + add).toFixed(3);

      receivedCash = next.toFixed(3);
      cash = Math.min(next, total - benefit);

      errorEl.textContent = "";
      render();
    };
  });

  const fillCashBtn = payBody.querySelector("#fillCashRemaining");
if (fillCashBtn) {
  fillCashBtn.onclick = () => {
    const remaining = total - benefit;
    if (remaining <= 0) return;

    receivedCash = remaining.toFixed(3);
    cash = remaining;

    errorEl.textContent = "";
    render();
  };
}

  const fillBtn = payBody.querySelector("#fillRemaining");
  if (fillBtn) {
    fillBtn.onclick = () => {
      const r = total - cash;
      if (r <= 0) return;

      benefit = +r.toFixed(3);
      errorEl.textContent = "";
      render();
    };
  }
}

  render();

  overlay.querySelector("#tabCash").onclick = () => {
  mode = "cash";
  errorEl.textContent = "";
  render();
};

overlay.querySelector("#tabBenefit").onclick = () => {
  mode = "benefit";
  receivedCash = 0;      // ✅ مهم: تصفير كاش النصي
  errorEl.textContent = "";
  render();

  setTimeout(() => {
    const input = overlay.querySelector("#payInput");
    input?.focus();
  }, 0);
};

  overlay.querySelector("#confirmPay").onclick = async () => {
    if (Math.abs((cash + benefit) - total) > 0.001) {
      errorEl.textContent = "❌ لم يتم سداد كامل المبلغ";
      return;
    }

    const round3 = n => Number(Number(n).toFixed(3));

    const safeCash = round3(cash);
    const safeBenefit = round3(benefit);
    const safeTotal = round3(safeCash + safeBenefit);

await supabase.from("orders").update({
  is_paid: true,
  payment_method:
    safeCash > 0 && safeBenefit > 0 ? "mixed" :
    safeCash > 0 ? "cash" : "benefit",

  cash_amount: safeCash,
  benefit_amount: safeBenefit,
  total: safeTotal,
  paid_at: new Date().toISOString(),
  status: "active"  
}).eq("id", orderId);

    overlay.remove();
    loadActiveOrders();
    alert("✅ تم تسجيل الدفع، اضغط (مكتمل)");
  };

  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();
};

   /* 🗑 حذف */
  window.deleteOrder = async id => {
    if (!confirm("حذف الفاتورة نهائيًا؟")) return;
    await supabase.from("order_items").delete().eq("order_id", id);
    await supabase.from("orders").delete().eq("id", id);
    loadActiveOrders();
  };

  /* ✅ إكمال الطلب */
  window.markCompleted = async id => {
    if (!confirm("تأكيد إكمال الطلب؟")) return;
    
    try {
      await supabase.from("orders").update({
        is_completed: true,
        completed_at: new Date().toISOString(),
        status: "completed"
      }).eq("id", id);
      
      loadActiveOrders();
      alert("✅ تم إكمال الطلب!");
    } catch (error) {
      alert("❌ خطأ: " + error.message);
    }
  };
  /* ===============================
     👁 عرض الفاتورة + طباعة
  ================================ */
  
  window.viewOrder = async function (orderId) {
    const { data: order, error } = await supabase
      .from("orders")
      .select("order_items, total, invoice_no, customer_name")
      .eq("id", orderId)
      .single();

    if (error || !order) {
      console.error("Error fetching order for invoice:", error);
      alert("لا توجد بيانات للفاتورة");
      return;
    }

    const items = order.order_items || [];

    if (!Array.isArray(items) || items.length === 0) {
      alert("لا توجد بيانات للفاتورة");
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "variant-overlay";

    overlay.innerHTML = `
      <div class="variant-box" id="invoiceContent" style="max-width:500px">
        <h3>🧾 تفاصيل الفاتورة ${order.invoice_no ? `#${order.invoice_no}` : ""}</h3>

        <div style="text-align:right;max-height:300px;overflow:auto">
          ${items.map(i => {
            const variantLabel = i.variant ? ` - ${i.variant.label || ""}` : "";
            const itemName = (i.productName || i.item_name || "صنف") + variantLabel;
            const qty = i.qty || 1;
            const price = parseFloat(i.price || 0);
            const addonsTotal = (i.addons || []).reduce((s, a) => s + parseFloat(a.price || 0), 0);
            const lineTotal = (price + addonsTotal) * qty;
            const extrasRemoved = i.extras_removed || i.extrasRemoved || [];
            return `
            <div style="border-bottom:1px dashed #ddd;padding:8px 0">
              <strong>${itemName}</strong>
              ${
                extrasRemoved.length
                  ? `<div style="font-size:13px;color:#555">
                       بدون: ${extrasRemoved.join("، ")}
                     </div>`
                  : ""
              }
              ${
                i.addons?.length
                  ? `<div style="font-size:13px;color:#16a34a">
                       + ${i.addons.map(a => a.name).join("، ")}
                     </div>`
                  : ""
              }
              ${
                i.is_spicy || i.isSpicy
                  ? `<div style="font-size:13px;color:#D97706">🌶️ سبايسي</div>`
                  : ""
              }
              الكمية: ${qty}<br>
              السعر: ${lineTotal.toFixed(3)} د.ب
            </div>
          `;
          }).join("")}
        </div>

        <div style="text-align:left;margin-top:10px;font-weight:900">
          الإجمالي: ${parseFloat(order.total || 0).toFixed(3)} د.ب
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
  
  
  
  // ===============================
  // 👨‍🍳 وجبات الموظفين (الدخول)
  // ===============================
  window.openEmployeeCoupon = function () {

  if (employeeMode) {
    alert("⚠️ أنت بالفعل في وضع الموظف");
    return;
  }

  if (document.querySelector(".variant-overlay")) return;

  const overlay = document.createElement("div");
  overlay.className = "variant-overlay";

  overlay.innerHTML = `
    <div class="variant-box" style="max-width:400px;text-align:center">

      <h3 style="margin-bottom:15px">🎟 دخول كوبون الموظف</h3>

      <input 
        type="text"
        id="empCodeInput"
        placeholder="رقم الموظف"
        style="width:100%;padding:10px;margin-bottom:10px"
      >

      <input 
        type="password"
        id="empPassInput"
        placeholder="الرقم السري"
        style="width:100%;padding:10px;margin-bottom:10px"
      >

      <div id="empLoginError" style="color:#dc2626;font-size:14px;margin-bottom:8px"></div>

      <button class="variant-btn" id="empLoginBtn">
        🔓 دخول
      </button>

      <button class="variant-cancel">إلغاء</button>

    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".variant-cancel").onclick = () => overlay.remove();

  overlay.querySelector("#empLoginBtn").onclick = async () => {

    const employeeCode = document.getElementById("empCodeInput").value.trim();
    const password = document.getElementById("empPassInput").value.trim();
    const errorBox = document.getElementById("empLoginError");

    if (!employeeCode || !password) {
      errorBox.textContent = "❌ أدخل جميع البيانات";
      return;
    }

    const { data: employee, error } = await supabase
  .from("employees")
  .select("id, employee_code, name, pin_hash")
  .eq("employee_code", employeeCode)
  .single();

    if (error || !employee) {
      errorBox.textContent = "❌ رقم الموظف غير صحيح";
      return;
    }

    if (employee.pin_hash !== password) {
      errorBox.textContent = "❌ الرقم السري غير صحيح";
      return;
    }

    const month = new Date().toISOString().slice(0, 7);

    const { data: coupon } = await supabase
  .from("employee_coupons")
  .select("*")
  .eq("employee_id", employee.id)     
  .eq("month", month)
  .maybeSingle();

    if (!coupon) {
      errorBox.textContent = "❌ لا يوجد كوبون لهذا الشهر";
      return;
    }

    if (!coupon.active) {
      errorBox.textContent = "❌ الكوبون موقوف من الإدارة";
      return;
    }

    if (coupon.remaining_amount <= 0) {
      errorBox.textContent = "❌ الرصيد منتهي";
      return;
    }

    // ✅ تفعيل الوضع
    employeeMode = {
  employee_id: employee.id,
  employee_code: employee.employee_code,
  employee_name: employee.name,
  remaining: coupon.remaining_amount
};

    document.body.classList.add("employee-mode");

    document.getElementById("sideMenu")?.classList.remove("open");
    document.getElementById("overlay")?.classList.remove("show");

    const banner = document.getElementById("employeeBanner");
    const nameSpan = document.getElementById("employeeName");
    const balanceSpan = document.getElementById("employeeBalance");

    if (banner && nameSpan && balanceSpan) {
      banner.style.display = "block";
      nameSpan.textContent =
        `${employee.name} (ID: ${employee.employee_code})`;
      balanceSpan.textContent =
        coupon.remaining_amount.toFixed(3);
    }

    overlay.remove();
  };
};
  
  
  
  /* ===============================
     NAV
  ================================ */
  window.closeDay = () => location.href = "report.html";
  window.goToReports = () => location.href = "reports.html";
  window.goToSettings = () => location.href = "settings.html";
  
  // ===============================
  // 🔐 دخول الإدارة
  // ===============================
  window.openAdmin = function () {
    // نمسح أي دخول قديم
    sessionStorage.removeItem("admin_auth");
  

  };
  // ===============================
  // تسجيل الخروج
  // ===============================
  window.logout = async function () {
    if (isSavingOrder) {
      alert("⏳ انتظر حفظ الطلب قبل تسجيل الخروج");
      return;
    }
  
    if (!confirm("هل أنت متأكد من تسجيل الخروج؟")) return;
  
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
        ${
          item.addons?.length
            ? `<div class="extras">+ ${item.addons.map(a => a.name).join("، ")}</div>`
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
  window.exitEmployeeMode = function () {
  
    // ❌ إلغاء ستايل وضع الموظف
    employeeMode = null;

document.body.classList.remove("employee-mode");

const banner = document.getElementById("employeeBanner");
if (banner) banner.style.display = "none";
  
    alert("🚪 تم الخروج من وضع الموظف");
  };
  
  // 🔒 إذا انفتح أي Popup → نقفل القائمة
  document.addEventListener("click", (e) => {
  const popup = document.querySelector(".variant-overlay");
  const sideMenu = document.getElementById("sideMenu");
  const overlay = document.getElementById("overlay");

  if (popup) {
    sideMenu?.classList.remove("open");
    overlay?.classList.remove("show");
  }
});
/* ===============================
   خصم المواد الاستهلاكية من المخزون
================================ */
async function deductConsumables(orderId) {
  try {
    const { data: items } = await supabase
      .from("order_items")
      .select("product_id, variant_id, qty")
      .eq("order_id", orderId);

    if (!items || items.length === 0) return;

    for (const item of items) {

      // 🔎 نجيب كل المواد المرتبطة بالصنف
      const { data: consumables } = await supabase
        .from("product_consumables")
        .select("*")
        .eq("product_id", item.product_id);

      if (!consumables || consumables.length === 0) continue;

      for (const c of consumables) {

        // 🧠 القاعدة الذهبية:
        // إذا المادة مربوطة بـ Normal → نستخدم Normal دائمًا
        const finalSize =
          c.consumable_size === "Normal"
            ? "Normal"
            : c.consumable_size;

        const totalQty = c.qty * item.qty;

        const { error } = await supabase.rpc("decrement_consumable_stock", {
          p_consumable_id: c.consumable_id,
          p_size: finalSize,
          p_qty: totalQty
        });

        if (error) {
          console.error("STOCK DEDUCT ERROR:", error);
        }
      }
    }

  } catch (err) {
    console.error("DEDUCT CONSUMABLES ERROR:", err);
  }
}
window.openEmployeeLogin = function () {
  window.open("employee-login.html", "_blank");
};

window.openAdminEmployees = function () {
  window.open("admin-login.html", "_blank");
};
window.goToStorage = () => location.href = "storage.html";
window.goToEmployee = function() {
  window.location.href = "employee-login.html";
};

async function processEmployeePayout(orderId) {
  try {

    const { data: items } = await supabase
      .from("order_items")
      .select("id, product_id, qty, price")
      .eq("order_id", orderId);

    if (!items) return;

    for (const item of items) {

      const saleTotal = Number(item.price) * Number(item.qty);

      const { data: productEmployees } = await supabase
        .from("product_employees")
        .select("employee_id, commission_percent")
        .eq("product_id", item.product_id);

      if (!productEmployees || productEmployees.length === 0)
        continue;

      for (const pe of productEmployees) {

        const payout =
          saleTotal * (Number(pe.commission_percent) / 100);

        const { data: cycle } = await supabase
          .from("employee_cycles")
          .select("id")
          .eq("employee_id", pe.employee_id)
          .eq("status", "open")
          .maybeSingle();

        if (!cycle) continue;

        await supabase.from("employee_sales").insert({
          employee_id: pe.employee_id,
          product_id: item.product_id,
          order_item_id: item.id,
          cycle_id: cycle.id,
          quantity: item.qty,
          sale_price: item.price,
          payout_amount: payout
        });
      }
    }

  } catch (err) {
    console.error("PAYOUT ERROR:", err);
  }
  
}
