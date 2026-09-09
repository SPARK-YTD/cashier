import { supabase } from "./supabase.js";

let allBusinessDays = [];
let filteredDays = [];

window.applyFilters = applyFilters;
window.resetFilters = resetFilters;
window.viewReport = viewReport;
window.printReport = printReport;
window.deleteReportPrompt = deleteReportPrompt;

// =============== INITIALIZATION ===============
document.addEventListener("DOMContentLoaded", async () => {
  // تعيين التواريخ الافتراضية
  setDefaultDates();
  
  // تحميل البيانات
  await loadReports();
});

function setDefaultDates() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  
  document.getElementById("dateFrom").valueAsDate = firstDay;
  document.getElementById("dateTo").valueAsDate = today;
}

// =============== LOAD REPORTS ===============
// =============== LOAD REPORTS ===============
async function loadReports() {
  try {
    const { data, error } = await supabase
      .from("business_days")
      .select("*")
      .order("day_date", { ascending: false }); 
    
    if (error) throw error;
    
    allBusinessDays = data || [];
    filteredDays = [...allBusinessDays];
    
    applyFilters();
  } catch (error) {
    console.error("Error loading reports:", error);
    showError("خطأ في تحميل التقارير");
  }
}

// =============== FILTERS ===============
function applyFilters() {
  const dateFrom = document.getElementById("dateFrom").value;
  const dateTo = document.getElementById("dateTo").value;
  const month = document.getElementById("month").value;
  const year = document.getElementById("year").value;
  
  filteredDays = allBusinessDays.filter(day => {
    const dayDate = new Date(day.day_date);
    
    // تصفية حسب التاريخ
    if (dateFrom && dateFrom !== "") {
      const fromDate = new Date(dateFrom);
      if (dayDate < fromDate) return false;
    }
    
    if (dateTo && dateTo !== "") {
      const toDate = new Date(dateTo);
      if (dayDate > toDate) return false;
    }
    
    // تصفية حسب الشهر
    if (month && month !== "") {
      const dayMonth = (dayDate.getMonth() + 1).toString();
      if (dayMonth !== month) return false;
    }
    
    // تصفية حسب السنة
    if (year && year !== "") {
      const dayYear = dayDate.getFullYear().toString();
      if (dayYear !== year) return false;
    }
    
    return true;
  });
  
  renderReports();
}

function resetFilters() {
  setDefaultDates();
  document.getElementById("month").value = "";
  document.getElementById("year").value = "";
  filteredDays = [...allBusinessDays];
  renderReports();
}

// =============== RENDER REPORTS ===============
async function renderReports() {
  const tbody = document.getElementById("reportsTable");
  
  if (filteredDays.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-state">
          <p>📭 لا توجد تقارير للفترة المختارة</p>
        </td>
      </tr>
    `;
    updateSummary([], 0, 0);
    return;
  }
  
  tbody.innerHTML = "⏳ جاري التحميل...";
  
  let totalSales = 0;
  let totalOrders = 0;
  
  const rows = [];
  
  for (const day of filteredDays) {
    try {
      // احصل على الطلبات لهذا اليوم
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("business_day_id", day.id)
        .eq("is_paid", true);
      
      if (ordersError) throw ordersError;
      
      const dayOrders = orders || [];
      const orderCount = dayOrders.length;
      
      // احسب المبيعات
      const daySales = dayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      
      // احسب المتوسط
      const avgOrder = orderCount > 0 ? (daySales / orderCount).toFixed(3) : "0.000";
      
      // احسب توزيع الدفع
      const cashAmount = dayOrders.reduce((sum, order) => sum + (order.cash_amount || 0), 0);
      const cardAmount = dayOrders.reduce((sum, order) => sum + (order.benefit_amount || 0), 0);
      const paymentStr = `${cashAmount.toFixed(3)} / ${cardAmount.toFixed(3)}`;
      
      // احسب عدد الموظفين الفريدين
      const uniqueStaff = new Set(
        dayOrders
          .filter(o => o.is_employee_order && o.employee_code)
          .map(o => o.employee_code)
      );
      const staffCount = uniqueStaff.size;
      
      totalSales += daySales;
      totalOrders += orderCount;
      
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><strong>${formatDate(day.day_date)}</strong></td>
        <td>${orderCount}</td>
        <td style="color: #10B981; font-weight: 600;">${daySales.toFixed(3)} د.ب</td>
        <td>${avgOrder} د.ب</td>
        <td style="font-size: 12px;">
          <span style="color: #EF4444;">💵 ${cashAmount.toFixed(3)}</span><br>
          <span style="color: #3B82F6;">💳 ${cardAmount.toFixed(3)}</span>
        </td>
        <td style="text-align: center;">👤 ${staffCount}</td>
        <td>
          <div class="actions">
            <button class="btn-action view" onclick="viewReport('${day.id}')" title="عرض التفاصيل">👁️</button>
            <button class="btn-action print" onclick="printReport('${day.id}')" title="طباعة">🖨️</button>
            <button class="btn-action delete" onclick="deleteReportPrompt('${day.id}')" title="حذف">🗑️</button>
          </div>
        </td>
      `;
      rows.push(row);
    } catch (error) {
      console.error(`Error processing day ${day.id}:`, error);
    }
  }
  
  tbody.innerHTML = "";
  rows.forEach(row => tbody.appendChild(row));
  
  updateSummary(filteredDays, totalSales, totalOrders);
}

// =============== UPDATE SUMMARY ===============
function updateSummary(days, totalSales, totalOrders) {
  document.getElementById("totalSales").textContent = totalSales.toFixed(3);
  document.getElementById("totalOrders").textContent = totalOrders;
  document.getElementById("totalDays").textContent = days.length;
}

// =============== ACTIONS ===============
async function viewReport(dayId) {
  window.open(`day-report.html?dayId=${dayId}`, "dayReport", "width=900,height=700");
}

async function printReport(dayId) {
  const day = allBusinessDays.find(d => d.id === dayId);
  if (!day) return;
  
  // احصل على الطلبات
  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("business_day_id", dayId)
    .eq("is_paid", true);
  
  const dayOrders = orders || [];
  const totalSales = dayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
  const orderCount = dayOrders.length;
  
  // اطبع
  const printWindow = window.open("", "PRINT", "height=600,width=800");
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>تقرير ${formatDate(day.day_date)}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; direction: rtl; }
        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        .content { margin: 20px 0; }
        .row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px; border-bottom: 1px solid #ddd; }
        .label { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f0f0f0; padding: 10px; text-align: right; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>📊 تقرير اليوم</h2>
        <p>${formatDate(day.day_date)}</p>
      </div>
      
      <div class="content">
        <div class="row">
          <span class="label">عدد الطلبات:</span>
          <span>${orderCount}</span>
        </div>
        <div class="row">
          <span class="label">إجمالي المبيعات:</span>
          <span>${totalSales.toFixed(3)} د.ب</span>
        </div>
        <div class="row">
          <span class="label">متوسط الطلب:</span>
          <span>${orderCount > 0 ? (totalSales / orderCount).toFixed(3) : "0.000"} د.ب</span>
        </div>
      </div>
      
      <script>
        window.print();
        window.close();
      </script>
    </body>
    </html>
  `);
  
  printWindow.document.close();
}

async function deleteReportPrompt(dayId) {
  const password = prompt("🔐 أدخل كلمة المرور لحذف التقرير:");
  
  if (!password) return;
  
  if (password !== "9898") {
    alert("❌ كلمة المرور خاطئة!");
    return;
  }
  
  const confirm = window.confirm("⚠️ هل أنت متأكد من حذف هذا التقرير؟ هذا لا يمكن التراجع عنه!");
  
  if (!confirm) return;
  
  try {
    const { error: ordersError } = await supabase
      .from("orders")
      .delete()
      .eq("business_day_id", dayId);
    
    if (ordersError) throw ordersError;
    
    const { error: dayError } = await supabase
      .from("business_days")
      .delete()
      .eq("id", dayId);
    
    if (dayError) throw dayError;
    
    alert("✅ تم حذف التقرير بنجاح");
    
    allBusinessDays = allBusinessDays.filter(d => d.id !== dayId);
    filteredDays = filteredDays.filter(d => d.id !== dayId);
    renderReports();
  } catch (error) {
    console.error("Error deleting report:", error);
    alert("❌ خطأ في حذف التقرير");
  }
}

// =============== UTILS ===============
function formatDate(dateStr) {
  const date = new Date(dateStr);
  const options = { year: "numeric", month: "long", day: "numeric" };
  return date.toLocaleDateString("ar-SA", options);
}

function showError(message) {
  alert(`❌ ${message}`);
}
