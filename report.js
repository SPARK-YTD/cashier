import { supabase } from "./supabase.js";
import { applyLang } from "./i18n.js";

/*********************************
 * Get-Break | Daily Close Report
 *********************************/

let currentBusinessDay = null;
let ordersCache = [];

document.addEventListener("DOMContentLoaded", async () => {
  applyLang();

  const closeTimeEl   = document.getElementById("closeTime");
  const ordersCountEl = document.getElementById("ordersCount");
  const totalSalesEl  = document.getElementById("totalSales");
  const itemsReportEl = document.getElementById("itemsReport");
  const topItemEl     = document.getElementById("topItem");

  /* ===== جلب اليوم المفتوح ===== */
  const { data: openDay } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .single();

  currentBusinessDay = openDay || null;

  if (!currentBusinessDay) {
    closeTimeEl.textContent = "❌ لا يوجد يوم مفتوح";
    return;
  }

  /* ===== جلب الطلبات المكتملة ===== */
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
    .eq("business_day_id", currentBusinessDay.id);

  ordersCache = orders || [];

  if (!ordersCache.length) {
    closeTimeEl.textContent = "🕒 لا توجد طلبات مكتملة";
    ordersCountEl.textContent = "0";
    totalSalesEl.textContent  = "0.000 د.ب";
    topItemEl.textContent     = "—";
    itemsReportEl.innerHTML =
      "<tr><td colspan='3'>لا توجد بيانات</td></tr>";
    return;
  }

  /* ===== حساب الإحصائيات (معاينة فقط) ===== */
  let totalSales = 0;
  const itemsMap = {};

  ordersCache.forEach(o => {
    totalSales += o.total;
    o.order_items.forEach(i => {
      const name = i.products.name;
      itemsMap[name] ??= { qty: 0, total: 0 };
      itemsMap[name].qty += i.qty;
      itemsMap[name].total += i.qty * i.price;
    });
  });

  const topItem =
    Object.entries(itemsMap)
      .sort((a,b) => b[1].qty - a[1].qty)[0]?.[0] || "—";

  /* ===== عرض المعاينة ===== */
  closeTimeEl.textContent =
    "🕒 معاينة تقرير يوم: " + currentBusinessDay.day_date;

  ordersCountEl.textContent = ordersCache.length;
  totalSalesEl.textContent  = totalSales.toFixed(3) + " د.ب";
  topItemEl.textContent     = topItem;

  itemsReportEl.innerHTML = "";
  Object.entries(itemsMap).forEach(([name, item]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${item.qty}</td>
      <td>${item.total.toFixed(3)} د.ب</td>
    `;
    itemsReportEl.appendChild(tr);
  });
});

/* ===============================
   ⬅ رجوع للكاشير (نفس اليوم)
   ❌ لا حفظ
================================ */
window.backToCashier = function () {
  window.location.href = "index.html";
};

/* ===============================
   🔄 بدء يوم جديد (الحفظ الحقيقي)
   ✅ يحفظ التقرير
   ✅ يؤرشف
   ✅ يفتح يوم جديد
================================ */
window.startNewDay = async function () {
  if (!currentBusinessDay) return;

  const pass = prompt("🔒 أدخل كلمة المرور:");
  if (pass !== "1234") {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  if (!confirm("سيتم حفظ التقرير وبدء يوم جديد، هل أنت متأكد؟")) return;

  let totalSales = 0;
  const itemsMap = {};

  ordersCache.forEach(o => {
    totalSales += o.total;
    o.order_items.forEach(i => {
      const name = i.products.name;
      itemsMap[name] ??= { qty: 0, total: 0 };
      itemsMap[name].qty += i.qty;
      itemsMap[name].total += i.qty * i.price;
    });
  });

  const topItem =
    Object.entries(itemsMap)
      .sort((a,b)=>b[1].qty-a[1].qty)[0]?.[0] || "—";

  /* حفظ التقرير */
  await supabase.from("daily_reports").insert({
    business_day_id: currentBusinessDay.id,
    report_date: currentBusinessDay.day_date,
    orders_count: ordersCache.length,
    total_sales: totalSales,
    top_item: topItem,
    items: itemsMap
  });

  /* إقفال اليوم */
  await supabase.from("business_days")
    .update({
      is_open: false,
      closed_at: new Date().toISOString()
    })
    .eq("id", currentBusinessDay.id);

  /* فتح يوم جديد */
  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0,10),
    is_open: true,
    opened_at: new Date().toISOString()
  });

  alert("✅ تم حفظ التقرير وبدء يوم جديد");
  window.location.href = "index.html";
};

/* ===============================
   🖨 PDF
================================ */
window.downloadPDF = () => window.print(); 