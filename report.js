import { supabase } from "./supabase.js";
import { applyLang } from "./i18n.js";

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

  const { data: report } = await supabase
    .from("daily_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!report) {
    closeTimeEl.textContent = "—";
    ordersCountEl.textContent = "0";
    totalSalesEl.textContent  = "0.000 د.ب";
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
});

/* رجوع للكاشير (نفس اليوم) */
window.backToCashierSameDay = () => {
  window.location.href = "index.html";
};

/* بدء يوم جديد */
window.startNewDayFromReport = async function () {
  const pass = prompt("🔒 أدخل كلمة المرور:");
  if (pass !== "1234") return;

  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0,10),
    is_open: true,
    opened_at: new Date().toISOString()
  });

  window.location.href = "index.html";
};

window.downloadPDF = () => window.print();