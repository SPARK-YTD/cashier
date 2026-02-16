import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

const PASSWORD = "1234";
let editingItemId = null;

/* ===============================
   المواد الاستهلاكية
================================ */

let consumablesList = [];

// تحميل المواد الاستهلاكية من قاعدة البيانات
async function loadConsumables() {
  const { data, error } = await supabase
    .from("consumables")
    .select("*")
    .order("name");

  if (error) {
    console.error("LOAD CONSUMABLES ERROR:", error);
    return;
  }

  consumablesList = data || [];
}

// إضافة صف مادة استهلاكية
window.addConsumableRow = function () {
  const box = document.getElementById("consumablesBox");
  if (!box) return;

  const row = document.createElement("div");
  row.className = "variant-row";

  row.innerHTML = `
    <select class="consumable-select">
      <option value="">اختر مادة</option>
      ${consumablesList.map(c => `
        <option value="${c.id}">${c.name}</option>
      `).join("")}
    </select>

    <select class="consumable-size">
  <option value="Normal">Normal</option>
  <option value="Small">Small</option>
  <option value="Medium">Medium</option>
  <option value="Large">Large</option>
</select>

    <input
      type="number"
      step="0.01"
      min="0"
      class="consumable-qty"
      placeholder="الكمية"
      value="1"
    >

    <button type="button" onclick="this.parentElement.remove()">❌</button>
  `;

  box.appendChild(row);
};
/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  applyLang();
  loadConsumables();

  // 👇 هذا هو الكود الجديد
  const typeRadios = document.querySelectorAll('input[name="itemType"]');
  const variantsBox = document.getElementById("variantsBox");

  typeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      const type = radio.value;

      if (type === "normal") {
        variantsBox.style.display = "none";
      } else {
        variantsBox.style.display = "block";
      }
    });
  });
});

/* ===============================
   تسجيل الدخول
================================ */
window.login = async function () {
  const pass = document.getElementById("adminPass").value;

  if (pass !== PASSWORD) {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  document.getElementById("loginBox").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";
  document.getElementById("backBtn").style.display = "block";
  await loadItems();
};

/* ===============================
   رفع صورة (آمن)
================================ */
async function uploadImage(file) {
  try {
    // ⛔ منع أي ملف غير صورة
    if (!file.type.startsWith("image/")) {
      alert("❌ الملف لازم يكون صورة");
      return null;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    const path = `products/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
  .from("products")
  .upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type
  });

    if (error) throw error;

    return supabase
      .storage
      .from("products")
      .getPublicUrl(path).data.publicUrl;

  } catch (err) {
    console.error("UPLOAD IMAGE ERROR:", err);
    alert("❌ فشل رفع الصورة");
    return null;
  }
}

/* ===============================
   إضافة صنف (نهائي + مضمون)
================================ */
window.addItem = async function () {
  try {

    // ✅ أضف هذا هنا بالضبط
    const cleanNumber = (v) => {
      return typeof v === "number" && !isNaN(v) ? v : null;
    };

    const itemType =
      document.querySelector('input[name="itemType"]:checked')?.value || "normal";
      
    const isSpicy = document.getElementById("itemSpicy")?.checked || false;
    const name = document.getElementById("itemName").value.trim();
    const category = document.getElementById("itemCategory").value;
    const imageFile = document.getElementById("itemImage")?.files[0];

    const priceNormal = parseFloat(document.getElementById("itemPrice").value);
    const priceSmall  = parseFloat(document.getElementById("priceSmall").value);
    const priceMedium = parseFloat(document.getElementById("priceMedium").value);
    const priceLarge  = parseFloat(document.getElementById("priceLarge").value);

    const extrasRaw = document.getElementById("itemExtras")?.value || "";
    const extras = extrasRaw
      .split("\n")
      .map(e => e.trim())
      .filter(Boolean);

    if (!name) return alert("أدخل اسم الصنف");

    // === تحديد نوع الصنف ===
    const hasVariants = itemType !== "normal";

    if (!hasVariants && isNaN(priceNormal)) {
      return alert("أدخل السعر");
    }

    if (
  hasVariants &&
  cleanNumber(priceSmall) === null &&
  cleanNumber(priceMedium) === null &&
  cleanNumber(priceLarge) === null
) {
  return alert("أدخل سعر واحد على الأقل");
}

    let image_url = null;
    if (imageFile) {
      image_url = await uploadImage(imageFile);
      if (!image_url) return;
    }

/* === حفظ الصنف === */
let query;

if (editingItemId) {
  // ✏️ تعديل — نحافظ على الصورة والترتيب
  const { data: oldItem } = await supabase
    .from("products")
    .select("image_url, sort_order")
    .eq("id", editingItemId)
    .single();

  query = supabase
    .from("products")
    .update({
      name,
      category,
      price: hasVariants ? null : cleanNumber(priceNormal),
      has_variants: hasVariants,

      // 🟢 أهم سطرين في الدنيا
      image_url: image_url || oldItem?.image_url,
      sort_order: oldItem?.sort_order,

      extras_list: extras.join("\n"),
      is_spicy: isSpicy
    })
    .eq("id", editingItemId);
}
 else {
  // ➕ إضافة
query = supabase
  .from("products")
  .insert({
    name,
    category,
    price: hasVariants ? null : cleanNumber(priceNormal),
    has_variants: hasVariants,
    image_url,
    extras_list: extras.join("\n"),
    is_spicy: isSpicy, // 🌶 هنا بالضبط
    active: true,
    sort_order: Date.now()
  });
}

const { data: product, error } = await query.select().single();
if (error) throw error;
    /* حفظ المواد الاستهلاكية المرتبطة بالصنف */
const rows = document.querySelectorAll("#consumablesBox > div");

if (editingItemId) {
  await supabase
    .from("product_consumables")
    .delete()
    .eq("product_id", product.id);
}

const consumableRows = [];

rows.forEach(r => {
  const consumable_id = r.querySelector(".consumable-select")?.value;
  const size = r.querySelector(".consumable-size")?.value;
  const qty = parseFloat(r.querySelector(".consumable-qty")?.value || 0);

  if (consumable_id && qty > 0) {
    consumableRows.push({
      product_id: product.id,
      consumable_id,
      consumable_size: size,
      qty
    });
  }
});

if (consumableRows.length) {
  await supabase.from("product_consumables").insert(consumableRows);
}
    if (error) throw error;

    /* === الأحجام / الوجبات === */
    if (hasVariants) {
      if (editingItemId) {
        await supabase
          .from("product_variants")
          .delete()
          .eq("product_id", product.id);
      }

      const variants = [];

      // 🍔 برقر (عادي / وجبة)
if (itemType === "burger") {
  if (cleanNumber(priceSmall) !== null) {
    variants.push({
      product_id: product.id,
      label: "عادي",
      price: priceSmall,
      active: true
    });
  }

  if (cleanNumber(priceMedium) !== null) {
    variants.push({
      product_id: product.id,
      label: "وجبة",
      price: priceMedium,
      active: true
    });
  }
}
      // 📦 أحجام
      if (itemType === "sizes") {
  if (cleanNumber(priceSmall) !== null) {
    variants.push({
      product_id: product.id,
      label: "Small",
      price: priceSmall,
      active: true
    });
  }

  if (cleanNumber(priceMedium) !== null) {
    variants.push({
      product_id: product.id,
      label: "Medium",
      price: priceMedium,
      active: true
    });
  }

  if (cleanNumber(priceLarge) !== null) {
    variants.push({
      product_id: product.id,
      label: "Large",
      price: priceLarge,
      active: true
    });
  }
}

      if (variants.length) {
        const { error: vErr } = await supabase
          .from("product_variants")
          .insert(variants);
        if (vErr) throw vErr;
      }
    }

    clearForm();
    await loadItems();
    editingItemId = null;
    alert("✅ تم إضافة الصنف بنجاح");

  } catch (err) {
    console.error("ADD ITEM ERROR:", err);
    alert("❌ فشل إضافة الصنف");
  }
};

/* ===============================
   عرض الأصناف
================================ */
async function loadItems() {
  const box = document.getElementById("itemsList");
  if (!box) return;

  box.innerHTML = "";

  const { data, error } = await supabase
  .from("products")
  .select("*")
  .order("sort_order", { ascending: true })
  .order("created_at", { ascending: true });
  if (error) {
    console.error("LOAD ITEMS ERROR:", error);
    box.innerHTML = "<p>خطأ في تحميل الأصناف</p>";
    return;
  }

  if (!data || data.length === 0) {
    box.innerHTML = "<p>لا توجد أصناف</p>";
    return;
  }

  data.forEach((item, index) => {
  const div = document.createElement("div");
  div.className = "order-box";
  div.dataset.id = item.id;

  div.innerHTML = `
    ${
      item.image_url
        ? `<img src="${item.image_url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-bottom:6px">`
        : ""
    }

    <strong>#{index + 1} — ${item.name}</strong><br>

    ${item.has_variants ? "متعدد الأحجام" : `${Number(item.price).toFixed(3)} د.ب`} — ${item.category}<br>
    الحالة: ${item.active ? "نشط" : "موقوف"}<br><br>

    ${
      item.active
        ? `<button class="btn warn" onclick="toggleItem('${item.id}', false)">🚫 تعطيل</button>`
        : `<button class="btn success" onclick="toggleItem('${item.id}', true)">✅ تفعيل</button>`
    }

    <button class="btn secondary" onclick="editItem('${item.id}')">✏️ تعديل</button>
    <button class="btn danger" onclick="deleteItem('${item.id}')">🗑 حذف</button>
  `;

  box.appendChild(div);
});

/* ===============================
   تفعيل / تعطيل
================================ */
window.toggleItem = async function (id, state) {
  await supabase.from("products").update({ active: state }).eq("id", id);
  loadItems();
};

/* ===============================
   حذف صنف
================================ */
window.deleteItem = async function (id) {
  if (!confirm("هل أنت متأكد من الحذف؟")) return;

  await supabase.from("product_variants").delete().eq("product_id", id);
  await supabase.from("products").delete().eq("id", id);

  loadItems();
};
window.editItem = async function (id) {
  const { data: item, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !item) {
    alert("فشل تحميل الصنف");
    return;
  }

  editingItemId = id;

  // تعبئة البيانات الأساسية
  document.getElementById("itemName").value = item.name;
  document.getElementById("itemCategory").value = item.category;
  document.getElementById("itemPrice").value = item.price || "";
  document.getElementById("itemExtras").value =
  item.extras_list || "";
  document.getElementById("itemSpicy").checked = !!item.is_spicy;

  // ===== تحديد نوع الصنف (normal / burger / sizes) =====
  let itemType = "normal";

  if (item.has_variants) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("label")
      .eq("product_id", item.id);

    if (variants?.some(v => v.label === "وجبة" || v.label === "عادي")) {
      itemType = "burger";
    } else {
      itemType = "sizes";
    }
  }

  // تفعيل الراديو الصحيح
  const radio = document.querySelector(
    `input[name="itemType"][value="${itemType}"]`
  );
  if (radio) radio.checked = true;

  // إظهار / إخفاء الأحجام
  document.getElementById("variantsBox").style.display =
    item.has_variants ? "block" : "none";

  // تنظيف أسعار الأحجام (لمنع بقايا قديمة)
  document.getElementById("priceSmall").value = "";
  document.getElementById("priceMedium").value = "";
  document.getElementById("priceLarge").value = "";

  // تحميل أسعار الأحجام إذا موجودة
  if (item.has_variants) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", item.id);

    variants?.forEach(v => {
      if (v.label === "عادي" || v.label === "Small") {
        document.getElementById("priceSmall").value = v.price;
      }
      if (v.label === "وجبة" || v.label === "Medium") {
        document.getElementById("priceMedium").value = v.price;
      }
      if (v.label === "Large") {
        document.getElementById("priceLarge").value = v.price;
      }
    });
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
};
/* ===============================
   أدوات
================================ */
function clearForm() {
  document.querySelector('input[name="itemType"][value="normal"]').checked = true;
  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("itemImage").value = "";
  document.getElementById("variantsBox").style.display = "none";
  document.getElementById("priceSmall").value = "";
  document.getElementById("priceMedium").value = "";
  document.getElementById("priceLarge").value = "";
  document.getElementById("itemExtras").value = "";
  document.getElementById("itemSpicy").checked = false; // ✅ هنا
}

/* ===============================
   تفعيل السحب وترتيب الأصناف
================================ */

let sortableInstance = null;

function enableDragSort() {
  const list = document.getElementById("itemsList");
  if (!list) return;

  // حذف القديم لو موجود
  if (sortableInstance) {
    sortableInstance.destroy();
  }

  sortableInstance = new Sortable(list, {
    animation: 150,

    onEnd: async () => {
      const boxes = list.querySelectorAll(".order-box");

      for (let i = 0; i < boxes.length; i++) {
        const id = boxes[i].dataset.id;

        await supabase
          .from("products")
          .update({ sort_order: i })
          .eq("id", id);
      }

      console.log("✅ تم حفظ الترتيب الجديد");
    }
  });
}

window.goBack = () => location.href = "index.html";