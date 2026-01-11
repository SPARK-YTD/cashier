import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

/*********************************
 * Get-Break | Daily Close Report
 *********************************/

document.addEventListener("DOMContentLoaded", async () => {
  applyLang();

  const closeTimeEl   = document.getElementById("closeTime");
  const ordersCountEl = document.getElementById("ordersCount");
  const totalSalesEl  = document.getElementById("totalSales");
  const itemsReportEl = document.getElementById("itemsReport");
  const topItemEl     = document.getElementById("topItem");

  const params = new URLSearchParams(window.location.search);
  const isPreview = params.get("preview") === "1";

  /* ===== PREVIEW MODE (من الكاشير) ===== */
  if (isPreview) {
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
      .eq("status", "completed");

    if (!orders || orders.length === 0) {
      ordersCountEl.textContent = "0";
      totalSalesEl.textContent  = "0.000 د.ب";
      topItemEl.textContent     = "—";
      itemsReportEl.innerHTML =
        "<tr><td colspan='3'>لا توجد طلبات مكتملة</td></tr>";
      return;
    }

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

    const topItem =
      Object.entries(itemsMap)
        .sort((a,b)=>b[1].qty-a[1].qty)[0]?.[0] || "—";

    closeTimeEl.textContent =
      "🕒 تقرير معاينة – لم يتم الإقفال بعد";

    ordersCountEl.textContent = orders.length;
    totalSalesEl.textContent  = totalSales.toFixed(3) + " د.ب";
    topItemEl.textContent     = topItem;

    itemsReportEl.innerHTML = "";
    Object.keys(itemsMap).forEach(name => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${name}</td>
        <td>${itemsMap[name].qty}</td>
        <td>${itemsMap[name].total.toFixed(3)} د.ب</td>
      `;
      itemsReportEl.appendChild(tr);
    });

    return;
  }

  /* ===== ARCHIVE MODE (تقرير محفوظ) ===== */
  const { data: reports } = await supabase
    .from("daily_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!reports || reports.length === 0) {
    ordersCountEl.textContent = "0";
    totalSalesEl.textContent  = "0.000 د.ب";
    topItemEl.textContent     = "—";
    itemsReportEl.innerHTML =
      "<tr><td colspan='3'>لا يوجد تقرير محفوظ</td></tr>";
    return;
  }

  const report = reports[0];

  closeTimeEl.textContent =
    "🕒 وقت الإقفال: " +
    new Date(report.created_at).toLocaleString("ar-BH");

  ordersCountEl.textContent = report.orders_count;
  totalSalesEl.textContent  =
    Number(report.total_sales).toFixed(3) + " د.ب";
  topItemEl.textContent     = report.top_item || "—";

  itemsReportEl.innerHTML = "";
  Object.keys(report.items || {}).forEach(name => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${report.items[name].qty}</td>
      <td>${report.items[name].total.toFixed(3)} د.ب</td>
    `;
    itemsReportEl.appendChild(tr);
  });
});

/* ===== بدء يوم جديد (الحفظ الحقيقي) ===== */
window.newDay = async function () {
  const pass = prompt("🔒 أدخل كلمة المرور لبدء يوم جديد:");
  if (pass !== "1234") return alert("❌ كلمة المرور غير صحيحة");

  if (!confirm("هل أنت متأكد من بدء يوم جديد؟")) return;

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
    .eq("status", "completed");

  if (!orders || orders.length === 0)
    return alert("لا توجد طلبات مكتملة");

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

  const topItem =
    Object.entries(itemsMap)
      .sort((a,b)=>b[1].qty-a[1].qty)[0]?.[0] || "—";

  await supabase.from("daily_reports").insert({
    report_date: new Date().toISOString().slice(0,10),
    orders_count: orders.length,
    total_sales: totalSales,
    top_item: topItem,
    items: itemsMap
  });

  await supabase
    .from("orders")
    .update({ status: "closed" })
    .eq("status", "completed");

  alert("✅ تم حفظ التقرير وبدء يوم جديد");
  window.location.href = "index.html";
};

/* ===== NAV ===== */
window.goBack = () => window.location.href = "index.html";
window.downloadPDF = () => window.print();