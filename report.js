import { supabase } from "./supabase.js";
import { applyLang } from "./i18n.js";

/*********************************
 * Get-Break | Daily Report
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
    .maybeSingle();

  if (!report) return;

  closeTimeEl.textContent =
    new Date(report.created_at).toLocaleString("ar-BH");

  ordersCountEl.textContent = report.orders_count;
  totalSalesEl.textContent  = report.total_sales.toFixed(3) + " د.ب";
  topItemEl.textContent     = report.top_item || "—";

  itemsReportEl.innerHTML = "";
  Object.entries(report.items || {}).forEach(([name, val]) => {
    itemsReportEl.innerHTML += `
      <tr>
        <td>${name}</td>
        <td>${val.qty}</td>
        <td>${val.total.toFixed(3)} د.ب</td>
      </tr>
    `;
  });
});

/* ===== BACK TO CASHIER (SAME DAY) ===== */
window.backToCashierSameDay = () => {
  window.location.href = "index.html";
};

/* ===== START NEW DAY ===== */
window.startNewDayFromReport = async () => {
  const pass = prompt("🔒 كلمة المرور:");
  if (pass !== "1234") return;

  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0,10),
    is_open: true,
    opened_at: new Date().toISOString()
  });

  window.location.href = "index.html";
};

window.downloadPDF = () => window.print();