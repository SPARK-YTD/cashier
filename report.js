import { supabase } from "./supabase.js";

let currentReport = null;

/* =========================
   تحميل آخر تقرير محفوظ
========================= */
document.addEventListener("DOMContentLoaded", async () => {
  const closeTimeEl   = document.getElementById("closeTime");
  const ordersCountEl = document.getElementById("ordersCount");
  const totalSalesEl  = document.getElementById("totalSales");
  const topItemEl     = document.getElementById("topItem");
  const itemsBox      = document.getElementById("itemsReport");

  const { data: report } = await supabase
    .from("daily_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!report) {
    closeTimeEl.textContent = "لا يوجد تقرير محفوظ";
    return;
  }

  currentReport = report;

  closeTimeEl.textContent =
    "🕒 وقت الإقفال: " +
    new Date(report.created_at).toLocaleString("ar-BH");

  ordersCountEl.textContent = report.orders_count;
  totalSalesEl.textContent =
    Number(report.total_sales).toFixed(3) + " د.ب";

  topItemEl.textContent = report.top_item || "—";

  itemsBox.innerHTML = "";
  Object.entries(report.items || {}).forEach(([name, item]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td>${item.qty}</td>
      <td>${item.total.toFixed(3)} د.ب</td>
    `;
    itemsBox.appendChild(tr);
  });
});

/* =========================
   بدء يوم جديد (الحفظ الرسمي)
========================= */
window.startNewDay = async function () {
  const pass = prompt("🔒 أدخل كلمة المرور:");
  if (pass !== "1234") {
    alert("كلمة المرور غير صحيحة");
    return;
  }

  if (!confirm("هل أنت متأكد من بدء يوم جديد؟")) return;

  // إقفال أي يوم مفتوح
  const { data: openDay } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .single();

  if (openDay) {
    await supabase.from("business_days")
      .update({ is_open: false, closed_at: new Date().toISOString() })
      .eq("id", openDay.id);
  }

  // فتح يوم جديد
  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0,10),
    is_open: true,
    opened_at: new Date().toISOString()
  });

  alert("✅ تم حفظ التقرير وبدء يوم جديد");
  window.location.href = "index.html";
};

/* =========================
   رجوع للكاشير (نفس اليوم)
========================= */
window.backToCashier = () => {
  window.location.href = "index.html";
};

/* =========================
   PDF
========================= */
window.downloadPDF = () => window.print();