import { supabase } from "./supabase.js";
import { applyLang } from "./i18n.js";

let currentBusinessDay = null;

document.addEventListener("DOMContentLoaded", async () => {
  applyLang();

  const closeTimeEl   = document.getElementById("closeTime");
  const ordersCountEl = document.getElementById("ordersCount");
  const totalSalesEl  = document.getElementById("totalSales");
  const itemsReportEl = document.getElementById("itemsReport");
  const topItemEl     = document.getElementById("topItem");

  const params = new URLSearchParams(location.search);
  const isPreview = params.get("preview") === "1";

  const { data: day } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .single();

  currentBusinessDay = day;
  if (!currentBusinessDay) return;

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      total,
      order_items (
        qty,
        price,
        products ( name )
      )
    `)
    .eq("status", "completed")
    .eq("business_day_id", currentBusinessDay.id);

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

  closeTimeEl.textContent = isPreview
    ? "📊 معاينة إقفال اليوم"
    : "—";

  ordersCountEl.textContent = orders.length;
  totalSalesEl.textContent  = totalSales.toFixed(3) + " د.ب";

  const topItem =
    Object.entries(itemsMap).sort((a,b)=>b[1].qty-a[1].qty)[0]?.[0] || "—";

  topItemEl.textContent = topItem;

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
   بدء يوم جديد (الحفظ الحقيقي)
================================ */
window.startNewDayFromReport = async function () {
  const pass = prompt("🔒 كلمة المرور:");
  if (pass !== "1234") return;

  if (!confirm("حفظ التقرير وبدء يوم جديد؟")) return;

  const { data: orders } = await supabase
    .from("orders")
    .select(`
      total,
      order_items (
        qty,
        price,
        products ( name )
      )
    `)
    .eq("status", "completed")
    .eq("business_day_id", currentBusinessDay.id);

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
    business_day_id: currentBusinessDay.id,
    report_date: currentBusinessDay.day_date,
    orders_count: orders.length,
    total_sales: totalSales,
    items: itemsMap
  });

  await supabase.from("business_days")
    .update({ is_open: false, closed_at: new Date().toISOString() })
    .eq("id", currentBusinessDay.id);

  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0,10),
    is_open: true,
    opened_at: new Date().toISOString()
  });

  location.href = "index.html";
};

window.backToCashierSameDay = () => location.href = "index.html";
window.downloadPDF = () => window.print();
