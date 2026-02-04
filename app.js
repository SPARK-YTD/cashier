  
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
  let ordersChannel; 
  let employeeMode = null;
  /* ===============================
     Business Day Helper
  ================================ */
  async function getOrCreateBusinessDay() {
    const { data } = await supabase
      .from("business_days")
      .select("*")
      .eq("is_open", true)
      .order("opened_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  
    if (data) return data;
  
    const today = new Date().toISOString().slice(0, 10);
  
    const { data: newDay, error } = await supabase
      .from("business_days")
      .insert({
        day_date: today,
        is_open: true,
        opened_at: new Date().toISOString()
      })
      .select()
      .single();
  
    if (error) {
      console.error("❌ Failed to create business day", error);
      return null;
    }
  
    console.log("🟢 New business day created");
    return newDay;
  }
  
  
  /* ===============================
     INIT (OPTIMIZED)
  ================================ */
  document.addEventListener("DOMContentLoaded", async () => {
  
    // 🔐 تحقق سريع من الجلسة (أسرع من getSession)
    const {
      data: { session }
    } = await supabase.auth.getSession();
  
    if (!session) {
      location.href = "login.html";
      return;
    }
  
    // 🚀 واجهة فورية
    applyLang();
    renderCart();
  
  // 📦 تحميل البيانات بعد التأكد من الدخول
  currentBusinessDay = await getOrCreateBusinessDay();
  
  if (!currentBusinessDay) {
    alert("❌ خطأ في إنشاء يوم العمل");
    return;
  }
  console.log("📅 Current Business Day:", currentBusinessDay);
  
  
  
    loadItems("food");        // بدون await (غير حاجز)
    loadActiveOrders();       // بدون await
    subscribeToOrders();
    
  
    // تحديث الطلبات كل دقيقة
   // setInterval(loadActiveOrders, 60000);
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
  
    if (
  (Array.isArray(item.extras) && item.extras.length > 0) ||
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
  .filter(cb =>
    cb.id !== "spicyOption" && !cb.checked
  )
  .map(cb => cb.value);

  const isSpicy =
    overlay.querySelector("#spicyOption")?.checked || false;

  let nameWithExtras = item.name;

  if (isSpicy) {
    nameWithExtras += " 🌶 سبايسي";
  }

  if (unchecked.length > 0) {
    nameWithExtras += ` (بدون: ${unchecked.join("، ")})`;
  }

  addToCart({
    id: item.id,
    name: nameWithExtras,
    price: item.price,
    variant_id: item.variant_id || null,
    extras_removed: unchecked,
    is_spicy: isSpicy
  });
  
      overlay.remove();
    };
  }
  
  window.selectVariant = function (productId, name, variantId, label, price) {
  const baseItem = items.find(i => i.id === productId);

  if (
    (baseItem?.extras?.length > 0) ||
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
  i.is_spicy === (item.is_spicy || false) &&
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
  extras_removed: item.extras_removed || [],
  is_spicy: item.is_spicy || false
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
  
   // 1️⃣ زيادة عدّاد الفواتير لليوم الحالي
const { data: dayData, error: dayErr } = await supabase
  .from("business_days")
  .update({
    invoice_counter: currentBusinessDay.invoice_counter + 1
  })
  .eq("id", currentBusinessDay.id)
  .select("invoice_counter")
  .single();

if (dayErr) {
  alert("❌ خطأ في عدّاد الفواتير");
  if (completeBtn) completeBtn.disabled = false;
  isSavingOrder = false;
  return;
}

const invoiceNo = dayData.invoice_counter; // ✅ هذا السطر المنقذ
      // استدعاء الدالة الآمنة لزيادة رقم الفاتورة
    /*const { data: newInvoiceNo, error: rpcError } = await supabase
      .rpc('increment_invoice_counter', { row_id: currentBusinessDay.id });

    if (rpcError || !newInvoiceNo) {
      alert("❌ خطأ في إنشاء رقم الفاتورة");
      if (completeBtn) completeBtn.disabled = false;
      isSavingOrder = false;
      return;
    }

    const invoiceNo = newInvoiceNo;

  const invoiceNo = dayData.invoice_counter; */
  
  // 2️⃣ إنشاء الطلب برقم الفاتورة الجديد
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      total,
      status: "active",
      business_day_id: currentBusinessDay.id,
      invoice_no: invoiceNo,
      timer_started_at: new Date().toISOString(),
  
      is_employee_order: employeeMode ? true : false,
      employee_code: employeeMode ? employeeMode.employee_code : null,
  
      // 👇 مهم
      is_paid: employeeMode ? true : false,
      payment_method: employeeMode ? "employee" : null
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
  currentInvoiceNo = order.invoice_no;
  
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
            extras_removed: i.extras_removed || []
          }))
        );
      }
       await loadActiveOrders(); // ✅ تحديث فوري للطلبات الجارية
  // خصم رصيد الموظف + الخروج من الوضع
  if (employeeMode) {
    await supabase
    .from("employee_coupons")
    .update({
      remaining_amount: employeeMode.remaining - total
    })
    .eq("employee_code", employeeMode.employee_code)
    .eq("month", new Date().toISOString().slice(0, 7))
    .limit(1);
  
    employeeMode = null;
  
    const banner = document.getElementById("employeeBanner");
    if (banner) banner.style.display = "none";
  }
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
      const exists = activeOrders.some(o => o.id === payload.new.id);
      if (exists) return; // ⛔️ يمنع التكرار
  
      console.log("🟢 NEW ORDER:", payload.new);
  
      activeOrders.unshift(payload.new); // إضافة فورية
      renderActiveOrders();               // رسم مباشر
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
    employees:employees!orders_employee_code_fkey(name)
  `)
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
  
        <button
          onclick="markEmployeeDone('${order.id}')"
          style="
            margin-top:8px;
            background:#7c3aed;
            color:white;
            border:none;
            padding:6px 10px;
            border-radius:6px;
            font-weight:700;
            cursor:pointer;
          ">
          ✅ مكتمل
        </button>
      `
      : order.kitchen_ready
        ? `<div style="color:#16a34a;font-weight:800">🟢 جاهز</div>`
        : `<div style="color:#facc15;font-weight:700">⏳ قيد التحضير</div>`
  }
  
    ${order.total.toFixed(3)} د.ب<br>
  
    ${
      order.is_employee_order
        ? ""
        : `
          <button onclick="viewOrder('${order.id}')">👁 عرض الفاتورة</button>
          <button onclick="editOrder('${order.id}')">✏️ تعديل</button>
          ${
            order.is_paid
              ? `<span style="color:#166534;font-weight:800;">✔ مدفوعة</span>`
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
  
    loadActiveOrders();
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
      .select("total, cash_amount, benefit_amount")
      .eq("id", orderId)
      .single();

    if (error || !freshOrder) {
      alert("❌ تعذر التحقق من بيانات الدفع");
      return;
    }

    const paidSum =
      Number(freshOrder.cash_amount || 0) +
      Number(freshOrder.benefit_amount || 0);

    if (paidSum.toFixed(3) !== Number(freshOrder.total).toFixed(3)) {
      alert("❌ مبلغ الدفع لا يساوي إجمالي الفاتورة");
      return;
    }

    if (!confirm("⚠️ هل تريد إقفال الفاتورة وإدخالها في التقرير؟")) return;

    await supabase
      .from("orders")
      .update({
        status: "completed",
        closed_at: new Date().toISOString(),
        kitchen_ready: true
      })
      .eq("id", orderId);

    loadActiveOrders();

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
    if ((cash + benefit).toFixed(3) !== total.toFixed(3)) {
      errorEl.textContent = "❌ لم يتم سداد كامل المبلغ";
      return;
    }

    await supabase.from("orders").update({
      is_paid: true,
      payment_method:
        cash > 0 && benefit > 0 ? "mixed" :
        cash > 0 ? "cash" : "benefit",
      cash_amount: cash,
      benefit_amount: benefit,
      paid_at: new Date().toISOString()
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
  
  
  
  // ===============================
  // 👨‍🍳 وجبات الموظفين (الدخول)
  // ===============================
  window.openEmployeeMeals = async function () {
  
    // 🔒 منع الدخول مرتين
    if (employeeMode) {
      alert("⚠️ أنت بالفعل في وضع الموظف");
      return;
    }
  
    // 1️⃣ رقم الموظف
    const employeeCode = prompt("👨‍🍳 أدخل رقم الموظف:");
    if (!employeeCode) return;
  
    // 2️⃣ رقم المدير
    const managerPin = prompt("🔐 أدخل رقم المدير:");
    if (!managerPin) return;
  
    // 3️⃣ جلب الموظف والتحقق من الرقم السري المرتبط به
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("employee_code, name, manager_pin")
      .eq("employee_code", employeeCode)
      .single();
  
    if (empError || !employee) {
      alert("❌ رقم الموظف غير موجود");
      return;
    }
  
    if (!employee.manager_pin) {
      alert("❌ هذا الموظف غير مرتبط بمدير");
      return;
    }
  
    if (employee.manager_pin !== managerPin) {
      alert("❌ رقم المدير غير صحيح لهذا الموظف");
      return;
    }
  
    // 4️⃣ جلب / إنشاء كوبون الشهر
    const month = new Date().toISOString().slice(0, 7);
  
    const { data: lastCoupon } = await supabase
      .from("employee_coupons")
      .select("total_amount")
      .eq("employee_code", employeeCode)
      .order("month", { ascending: false })
      .limit(1)
      .maybeSingle();
  
    if (!lastCoupon) {
      alert("❌ لا يوجد كوبون ثابت لهذا الموظف");
      return;
    }
  
    let { data: coupon } = await supabase
      .from("employee_coupons")
      .select("*")
      .eq("employee_code", employeeCode)
      .eq("month", month)
      .maybeSingle();
  
    if (!coupon) {
      const { data: newCoupon, error } = await supabase
        .from("employee_coupons")
        .insert({
          employee_code: employeeCode,
          month,
          total_amount: lastCoupon.total_amount,
          remaining_amount: lastCoupon.total_amount
        })
        .select()
        .single();
  
      if (error) {
        alert("❌ فشل إنشاء كوبون الشهر");
        return;
      }
  
      coupon = newCoupon;
    }
  
    if (coupon.remaining_amount <= 0) {
      alert("❌ رصيد الموظف منتهي لهذا الشهر");
      return;
    }
  
    // 5️⃣ تفعيل وضع الموظف
    employeeMode = {
      employee_code: employee.employee_code,
      employee_name: employee.name,
      remaining: coupon.remaining_amount
    };
  // ✅ تفعيل ستايل وضع الموظف
  document.body.classList.add("employee-mode");
  
  // ✅ إغلاق القائمة الجانبية إذا كانت مفتوحة
  document.getElementById("sideMenu")?.classList.remove("open");
  document.getElementById("overlay")?.classList.remove("show");
    // 🎨 تحديث البانر
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
  
    alert("✅ تم الدخول لوضع وجبات الموظفين");
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
  
    // نفتح صفحة الإدارة
    location.href = "admin.html";
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
    employeeMode = null;
  
    // ❌ إلغاء ستايل وضع الموظف
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