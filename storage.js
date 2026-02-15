import { supabase } from "./supabase.js";

/* ===============================
   تحميل المواد
================================ */
async function loadConsumables() {
  const { data: consumables } = await supabase
    .from("consumables")
    .select("*")
    .order("created_at");

  const { data: stock } = await supabase
    .from("consumable_stock")
    .select("*");

  renderTable(consumables || [], stock || []);
}

/* ===============================
   رسم الجدول
================================ */
function renderTable(consumables, stock) {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = "";

  consumables.forEach(c => {
    const getQty = size =>
      stock.find(s => s.consumable_id === c.id && s.size === size)?.quantity || 0;

    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${c.name}</td>

      <td><input type="number" value="${getQty("Small")}" id="s-${c.id}" /></td>
      <td><input type="number" value="${getQty("Medium")}" id="m-${c.id}" /></td>
      <td><input type="number" value="${getQty("Large")}" id="l-${c.id}" /></td>

      <td>
        <button class="save-btn" onclick="saveStock('${c.id}')">💾 حفظ</button>
      </td>
    `;

    tbody.appendChild(row);
  });
}

/* ===============================
   إضافة مادة جديدة
================================ */
window.addConsumable = async function () {
  const name = document.getElementById("name").value.trim();
  if (!name) return alert("أدخل الاسم");

  const { data: consumable, error } = await supabase
    .from("consumables")
    .insert({ name })
    .select()
    .single();

  if (error) return alert("فشل الإضافة");

  await supabase.from("consumable_stock").insert([
    { consumable_id: consumable.id, size: "Small", quantity: +smallQty.value || 0 },
    { consumable_id: consumable.id, size: "Medium", quantity: +mediumQty.value || 0 },
    { consumable_id: consumable.id, size: "Large", quantity: +largeQty.value || 0 }
  ]);

  location.reload();
};

/* ===============================
   حفظ الكميات
================================ */
window.saveStock = async function (id) {
  const sizes = ["Small", "Medium", "Large"];

  for (const size of sizes) {
    const input = document.getElementById(
      `${size[0].toLowerCase()}-${id}`
    );

    await supabase
      .from("consumable_stock")
      .update({ quantity: +input.value || 0, updated_at: new Date() })
      .eq("consumable_id", id)
      .eq("size", size);
  }

  alert("✅ تم تحديث المخزون");
};

/* ===============================
   INIT
================================ */
loadConsumables();