import { supabase } from "./supabase.js";
import { applyLang } from "./i18n.js";

/*********************************
 * Get-Break | Daily Close Report
 *********************************/

let currentBusinessDay = null;
let ordersCache = [];

/* ===============================
   حساب التقرير (دالة موحدة)
================================ */
function calculateReportData(orders) {
  let totalSales = 0;
  let cashTotal = 0;
  let benefitTotal = 0;
  const itemsMap = {};

  orders.forEach(o => {
    // 💳 طريقة الدفع
    if (o.payment_method === "cash") {
      cashTotal += o.total;
    } else if (o.payment_method === "benefit") {
      benefitTotal += o.total;
    }

    totalSales += o.total;

    o.order_items.forEach(i => {
      const name = i.products.name;
      const itemTotal = i.qty * i.price;

      itemsMap[name] ??= { qty: 0, total: 0 };
      itemsMap[name].qty += i.qty;
      itemsMap[name].total += itemTotal;
    });
  });

  const topItem =
    Object.entries(itemsMap)
      .sort((a, b) => b[1].qty - a[1].qty)[0]?.[0] || "—";

  return {
    totalSales,
    cashTotal,
    benefitTotal,
    itemsMap,
    topItem
  };
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  applyLang();

  const closeTimeEl   = document.getElementById("closeTime");
  const ordersCountEl = document.getElementById("ordersCount");
  const totalSalesEl  = document.getElementById("totalSales");
  const itemsReportEl = document.getElementById("itemsReport");
  const topItemEl     = document.getElementById("topItem");
  const cashTotalEl   = document.getElementById("cashTotal");
  const benefitTotalEl = document.getElementById("benefitTotal");
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get("id");

  /* ===============================
     عرض تقرير محفوظ
  ================================ */
  if (reportId) {
    const { data: report, error } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("id", reportId)
      .single();

    if (error || !report) {
      closeTimeEl.textContent = "❌ التقرير غير موجود";
      console.error(error);
      return;
    }

    closeTimeEl.textContent =
      "🕒 وقت الإقفال: " +
      new Date(report.created_at).toLocaleString("ar-BH");

    ordersCountEl.textContent = report.orders_count;
    totalSalesEl.textContent =
      Number(report.total_sales).toFixed(3) + " د.ب";
    topItemEl.textContent = report.top_item || "—";

    itemsReportEl.innerHTML = "";
    Object.entries(report.items || {}).forEach(([name, item]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${name}</td>
        <td>${item.qty}</td>
        <td>${item.total.toFixed(3)} د.ب</td>
      `;
      itemsReportEl.appendChild(tr);
    });

    return;
  }

  /* ===============================
     معاينة اليوم المفتوح
  ================================ */
const { data: openDay, error: openDayError } = await supabase
  .from("business_days")
  .select("*")
  .eq("is_open", true)
  .order("opened_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (openDayError) {
  console.error("❌ خطأ جلب اليوم المفتوح:", openDayError);
}

currentBusinessDay = openDay;

if (!currentBusinessDay) {
  closeTimeEl.textContent = "❌ لا يوجد يوم مفتوح";
  return;
}


const { data: orders, error: ordersError } = await supabase
  .from("orders")
  .select(`
    id,
    total,
    payment_method,
    order_items (
      qty,
      price,
      products ( name )
    )
  `)
  .eq("status", "completed")
  .eq("business_day_id", currentBusinessDay.id);
  
  if (ordersError) {
    console.error("❌ خطأ جلب الطلبات:", ordersError);
  }

  ordersCache = orders || [];

  if (!ordersCache.length) {
    closeTimeEl.textContent = "🕒 لا توجد طلبات مكتملة";
    ordersCountEl.textContent = "0";
    totalSalesEl.textContent = "0.000 د.ب";
    topItemEl.textContent = "—";
    itemsReportEl.innerHTML =
      "<tr><td colspan='3'>لا توجد بيانات</td></tr>";
    return;
  }

  const { totalSales, itemsMap, topItem } =
    calculateReportData(ordersCache);

  closeTimeEl.textContent =
    "🕒 معاينة تقرير يوم: " + currentBusinessDay.day_date;

  ordersCountEl.textContent = ordersCache.length;
  totalSalesEl.textContent = totalSales.toFixed(3) + " د.ب";
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
   بدء يوم جديد
================================ */
window.startNewDay = async function () {
  if (!currentBusinessDay) {
    alert("❌ لا يوجد يوم مفتوح");
    return;
  }

  const pass = prompt("🔒 أدخل كلمة المرور:");
  if (pass !== "1234") return alert("❌ كلمة المرور غير صحيحة");

  const { totalSales, itemsMap, topItem } =
    calculateReportData(ordersCache);

  const insertPayload = {
    business_day_id: currentBusinessDay.id,
    report_date: currentBusinessDay.day_date,
    orders_count: ordersCache.length,
    total_sales: totalSales,
    top_item: topItem,
    items: itemsMap
  };

  const { error } = await supabase
    .from("daily_reports")
    .insert(insertPayload);

  if (error) {
    alert("❌ فشل حفظ التقرير");
    console.error(error);
    return;
  }

  await supabase
    .from("business_days")
    .update({ is_open: false, closed_at: new Date().toISOString() })
    .eq("id", currentBusinessDay.id);

  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0, 10),
    is_open: true,
    opened_at: new Date().toISOString()
  });

  alert("✅ تم حفظ التقرير وبدء يوم جديد");
  window.location.href = "reports.html";
};

/* ===============================
   أدوات
================================ */
window.backToCashier = () => {
  window.location.href = "index.html";
};

window.downloadPDF = () => window.print();
