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
    totalSales += Number(o.total || 0);

    // ✅ المصدر الحقيقي للحساب
    cashTotal += Number(o.cash_amount || 0);
    benefitTotal += Number(o.benefit_amount || 0);

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
      cashTotalEl.textContent =
  Number(report.cash_total || 0).toFixed(3) + " د.ب";

benefitTotalEl.textContent =
  Number(report.benefit_total || 0).toFixed(3) + " د.ب";
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
  .eq("is_open", false)
.order("closed_at", { ascending: false })
.limit(1)
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
  cash_amount,
  benefit_amount,
  order_items (
    qty,
    price,
    products ( name )
  )
`)
  .in("status", ["completed", "paid"])
  .eq("is_employee_order", false)   // ✅ إخفاء طلبات الموظفين
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

  const {
  totalSales,
  cashTotal,
  benefitTotal,
  itemsMap,
  topItem
} = calculateReportData(ordersCache);

  closeTimeEl.textContent =
    "🕒 معاينة تقرير يوم: " + currentBusinessDay.day_date;

  ordersCountEl.textContent = ordersCache.length;
  totalSalesEl.textContent = totalSales.toFixed(3) + " د.ب";
  topItemEl.textContent = topItem;
  cashTotalEl.textContent =
    cashTotal.toFixed(3) + " د.ب";

  benefitTotalEl.textContent =
    benefitTotal.toFixed(3) + " د.ب";
  
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
// 🔍 فحص الطلبات غير المكتملة
const { data: openOrders, error: checkError } = await supabase
  .from("orders")
  .select("id")
  .eq("business_day_id", currentBusinessDay.id)
  .neq("status", "completed");

if (checkError) {
  alert("❌ خطأ أثناء فحص الطلبات");
  console.error(checkError);
  return;
}

if (openOrders.length > 0) {
  alert(`❌ لا يمكن إقفال اليوم
يوجد ${openOrders.length} طلب غير مكتمل`);
  return;
}
const {
  totalSales,
  cashTotal,
  benefitTotal,
  itemsMap,
  topItem
} = calculateReportData(ordersCache);

const insertPayload = {
  business_day_id: currentBusinessDay.id,
  report_date: currentBusinessDay.day_date,
  orders_count: ordersCache.length,
  total_sales: totalSales,
  cash_total: cashTotal,
  benefit_total: benefitTotal,
  top_item: topItem,
  items: itemsMap
};

  const { error: reportError } = await supabase
  .from("daily_reports")
  .insert(insertPayload);

if (reportError) {
  alert("❌ فشل حفظ التقرير");
  console.error(reportError);
  return;
}
  const { error: closeDayError } = await supabase
  .from("business_days")
  .update({ is_open: false, closed_at: new Date().toISOString() })
  .eq("id", currentBusinessDay.id);

if (closeDayError) {
  alert("❌ فشل إقفال اليوم");
  console.error(closeDayError);
  return;
}

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
