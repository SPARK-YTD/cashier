import { supabase } from "./supabase.js";

let day = null;

async function load() {
  const { data } = await supabase
    .from("business_days")
    .select("*")
    .eq("is_open", true)
    .single();

  day = data;

  const { data: orders } = await supabase
    .from("orders")
    .select("total")
    .eq("business_day_id", day.id);

  const total = orders.reduce((s,o)=>s+o.total,0);

  document.getElementById("summary").textContent =
    `عدد الطلبات: ${orders.length} | الإجمالي: ${total.toFixed(3)} د.ب`;
}

load();

window.startNewDay = async () => {
  const pass = prompt("كلمة المرور:");
  if (pass !== "1234") return;

  await supabase.from("daily_reports").insert({
    report_date: new Date().toISOString(),
    orders_count: 0
  });

  await supabase.from("business_days")
    .update({ is_open:false })
    .eq("id", day.id);

  await supabase.from("business_days").insert({
    day_date: new Date().toISOString().slice(0,10),
    is_open: true
  });

  location.href="index.html";
};

window.back = () => location.href="index.html";