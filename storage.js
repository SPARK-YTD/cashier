import { supabase } from "./supabase.js";

/* تحميل المواد */
async function loadConsumables() {
  const { data } = await supabase
    .from("consumables")
    .select("*")
    .order("created_at");

  const select = document.getElementById("stockConsumable");
  select.innerHTML = "";

  data?.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
}

/* إضافة مادة */
window.addConsumable = async function () {
  const name = document.getElementById("consumableName").value.trim();
  if (!name) return alert("اكتب اسم المادة");

  await supabase.from("consumables").insert({ name });

  document.getElementById("consumableName").value = "";
  loadConsumables();
  loadStock();
};

/* إضافة كمية */
window.addStock = async function () {
  const consumable_id = document.getElementById("stockConsumable").value;
  const size = document.getElementById("stockSize").value;
  const qty = parseFloat(document.getElementById("stockQty").value);

  if (!qty) return alert("اكتب الكمية");

  const { data: existing } = await supabase
    .from("consumable_stock")
    .select("*")
    .eq("consumable_id", consumable_id)
    .eq("size", size)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("consumable_stock")
      .update({ quantity: existing.quantity + qty })
      .eq("id", existing.id);
  } else {
    await supabase.from("consumable_stock").insert({
      consumable_id,
      size,
      quantity: qty
    });
  }

  document.getElementById("stockQty").value = "";
  loadStock();
};

/* عرض المخزون */
async function loadStock() {
  const { data } = await supabase
    .from("consumable_stock")
    .select(`
      quantity,
      size,
      consumables ( name )
    `)
    .order("size");

  const box = document.getElementById("stockList");
  box.innerHTML = "";

  data?.forEach(row => {
    const div = document.createElement("div");
    div.className = "order-box";

    div.innerHTML = `
      <strong>${row.consumables.name}</strong> — ${row.size}<br>
      الكمية الحالية: <b>${row.quantity}</b>
    `;

    box.appendChild(div);
  });
}

/* INIT */
loadConsumables();
loadStock();