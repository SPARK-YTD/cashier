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
  applyLang(); // ✅ هذا مكانها الصحيح

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
      <strong>${item.name}</strong>
      <span>${item.price.toFixed(3)} د.ب</span>
    `;
    div.onclick = () => addToCart(item);
    container.appendChild(div);
  });
}

/* ========= CART ========= */
function addToCart(item) {
  const found = cart.find(i => i.id === item.id);
  if (found) found.qty++;
  else cart.push({ ...item, qty: 1 });
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
  await supabase
    .from("orders")
    .update({ status: "completed" })
    .eq("id", id);

  loadActiveOrders();
};

window.cancelOrder = async function (id) {
  await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", id);

  loadActiveOrders();
};

/* ========= NAV ========= */
window.goToSettings = function () {
  window.location.href = "settings.html";
};

window.closeDay = async function () {
  const pass = prompt("🔒 أدخل كلمة المرور لإقفال اليوم:");
  if (pass !== "1234") {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  if (!confirm("هل أنت متأكد من إقفال اليوم؟")) return;

  /* ===== جلب الطلبات المكتملة ===== */
  const { data: orders, error } = await supabase
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
    .eq("status", "completed");

  if (error || !orders || orders.length === 0) {
    alert("لا توجد طلبات مكتملة لإقفال اليوم");
    return;
  }

  /* ===== حساب الإحصائيات ===== */
  let totalSales = 0;
  const itemsMap = {};

  orders.forEach(order => {
    totalSales += order.total;

    (order.order_items || []).forEach(oi => {
      const name = oi.products?.name || "—";
      if (!itemsMap[name]) {
        itemsMap[name] = { qty: 0, total: 0 };
      }
      itemsMap[name].qty += oi.qty;
      itemsMap[name].total += oi.qty * oi.price;
    });
  });

  /* ===== أكثر صنف مبيعًا ===== */
  let topItem = "—";
  let topQty = 0;
  Object.keys(itemsMap).forEach(name => {
    if (itemsMap[name].qty > topQty) {
      topQty = itemsMap[name].qty;
      topItem = name;
    }
  });

  /* ===== حفظ التقرير ===== */
  const { error: insertError } = await supabase
    .from("daily_reports")
    .insert({
      report_date: new Date().toISOString().slice(0, 10),
      orders_count: orders.length,
      total_sales: totalSales,
      top_item: topItem,
      items: itemsMap
    });

  if (insertError) {
    alert("فشل حفظ تقرير اليوم");
    console.error(insertError);
    return;
  }

  alert("✅ تم إقفال اليوم بنجاح");

  window.location.href = "report.html";
};
window.goToReports = function () {
  const pass = prompt("🔒 أدخل كلمة المرور للدخول إلى الأرشيف:");

  if (pass !== "1234") {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  window.location.href = "reports.html";
};
