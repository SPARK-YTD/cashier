import { supabase } from "./supabase.js";

const PASSWORD = "9898";
let editingItemId = null;

let employeesList = [];

async function loadEmployees() {
  const { data, error } = await supabase
    .from("employees")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("LOAD EMPLOYEES ERROR:", error);
    return;
  }

  employeesList = data || [];

}
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
   قائمة الخيارات (أنواع المشروبات وغيرها)
================================ */
window.addChoiceRow = function (label = "", price = "", labelEn = "") {
  const box = document.getElementById("choicesRows");
  if (!box) return;
  const row = document.createElement("div");
  row.className = "variant-row choice-row";
  row.style.flexWrap = "wrap";
  row.innerHTML = `
    <input type="text" class="choice-label" placeholder="اسم الخيار (مثلاً بيبسي)">
    <input type="number" step="0.001" min="0" class="choice-price" placeholder="السعر">
    <button type="button" onclick="this.parentElement.remove()">❌</button>
    <input type="text" class="choice-label-en" placeholder="English name (اختياري)" maxlength="80" dir="ltr" style="flex:1 1 100%; text-align:left">
  `;
  row.querySelector(".choice-label").value = label;
  row.querySelector(".choice-label-en").value = labelEn || "";
  row.querySelector(".choice-price").value = price;
  box.appendChild(row);
};

function readChoices() {
  const out = [];
  const seen = new Set();
  document.querySelectorAll("#choicesRows .choice-row").forEach(row => {
    const label = row.querySelector(".choice-label").value.trim().replace(/['"`\\]/g, "’");
    const price = parseFloat(row.querySelector(".choice-price").value);
    if (!label && isNaN(price)) return;
    if (!label || isNaN(price) || price < 0) throw new Error("CHOICE_INVALID");
    if (seen.has(label)) throw new Error("CHOICE_DUP");
    seen.add(label);
    const label_en = row.querySelector(".choice-label-en").value.trim().replace(/['"`\\]/g, "’") || null;
    out.push({ label, price, label_en });
  });
  return out;
}

/* ===============================
   الإضافات المدفوعة (Add-ons)
================================ */

window.addAddonRow = function () {
  const box = document.getElementById("addonsBox");
  if (!box) return;

  const row = document.createElement("div");
  row.className = "variant-row addon-row";
  row.style.flexWrap = "wrap";

  row.innerHTML = `
    <input type="text" class="addon-name" placeholder="اسم الإضافة">
    <input type="number" step="0.001" min="0" class="addon-price" placeholder="السعر">
    <button type="button" onclick="this.parentElement.remove()">❌</button>
    <input type="text" class="addon-name-en" placeholder="English name (اختياري)" maxlength="80" dir="ltr" style="flex:1 1 100%; text-align:left">
  `;

  box.appendChild(row);
};

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadConsumables();
  loadEmployees();
  
  
  const typeRadios = document.querySelectorAll('input[name="itemType"]');
  const variantsBox = document.getElementById("variantsBox");

  typeRadios.forEach(radio => {
    radio.addEventListener("change", () => {
      const type = radio.value;

      if (type === "normal" || type === "choices") {
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
// تصغير الصورة وتحويلها JPEG (يحل مشاكل الحجم الكبير وصيغ الجوال مثل HEIC)
async function shrinkImage(file, maxSide = 1200, quality = 0.85) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", quality));
    return blob && blob.size > 0 ? blob : null;
  } catch (e) {
    console.warn("shrinkImage failed, using original", e);
    return null;
  }
}

async function uploadImage(file) {
  try {
    // ⛔ منع أي ملف غير صورة
    if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) {
      alert("❌ الملف لازم يكون صورة");
      return null;
    }

    const small = await shrinkImage(file);
    const body = small || file;
    const type = small ? "image/jpeg" : (file.type || "image/jpeg");
    const ext = small ? "jpg" : (file.name.split(".").pop().toLowerCase() || "jpg");
    const path = `products/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("products")
      .upload(path, body, {
        cacheControl: "3600",
        upsert: false,
        contentType: type
      });

    if (error) throw error;

    return supabase
      .storage
      .from("products")
      .getPublicUrl(path).data.publicUrl;

  } catch (err) {
    console.error("UPLOAD IMAGE ERROR:", err);
    alert("❌ فشل رفع الصورة\n\nالسبب: " + (err?.message || err?.error || String(err)));
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
    const nameEn = (document.getElementById("itemNameEn")?.value || "").trim();
    // name_en عمود جديد: نرسله فقط لو في قيمة أو لو العمود موجود فعلاً (عشان ما ينكسر الحفظ قبل تشغيل SQL)
    const nameEnField = (nameEn || window.__hasNameEn) ? { name_en: nameEn || null } : {};
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

    // 🌐 ترجمة الإضافات الداخلية: نقارن سطر بسطر مع العربي (قبل حذف الأسطر الفاضية)
    const arLines = extrasRaw.split("\n").map(e => e.trim());
    const enLines = (document.getElementById("itemExtrasEn")?.value || "").split("\n").map(e => e.trim().replace(/['"`\\]/g, "’"));
    while (enLines.length && enLines[enLines.length - 1] === "") enLines.pop();
    if (enLines.length > arLines.length) {
      return alert("❌ الترجمة الإنجليزية أكثر أسطر من الإضافات العربية — لازم نفس الترتيب سطر بسطر");
    }
    const extrasEn = [];
    arLines.forEach((ar, i) => { if (ar) extrasEn.push(enLines[i] || ""); });
    const hasExtrasEn = extrasEn.some(Boolean);
    const extrasEnField = (hasExtrasEn || window.__hasExtrasEn) ? { extras_list_en: hasExtrasEn ? extrasEn.join("\n") : null } : {};

    if (!name) return alert("أدخل اسم الصنف");

    // === تحديد نوع الصنف ===
    const hasVariants = itemType !== "normal";

    if (!hasVariants && isNaN(priceNormal)) {
      return alert("أدخل السعر");
    }

    let choices = [];
    if (itemType === "choices") {
      try { choices = readChoices(); }
      catch (e) {
        return alert(e.message === "CHOICE_DUP" ? "❌ اسم خيار مكرر" : "❌ كل خيار لازم يكون له اسم وسعر صحيح");
      }
      if (choices.length === 0) return alert("أضف خيار واحد على الأقل");
    }

    if (
  hasVariants && itemType !== "choices" &&
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
  ...nameEnField,
  category,
  price: hasVariants ? null : cleanNumber(priceNormal),
  has_variants: hasVariants,
  image_url: image_url || oldItem?.image_url,
  sort_order: oldItem?.sort_order,
  extras_list: extras.join("\n"),
  ...extrasEnField,
  is_spicy: isSpicy,


})
    .eq("id", editingItemId);
}
 else {
  // ➕ إضافة
query = supabase
  .from("products")
  .insert({
    name,
    ...nameEnField,
    category,
    price: hasVariants ? null : cleanNumber(priceNormal),
    has_variants: hasVariants,
    image_url,
    extras_list: extras.join("\n"),
    ...extrasEnField,
    is_spicy: isSpicy,
    active: true,
    sort_order: Date.now(),

  });
}

const { data: product, error } = await query.select().single();
if (error) throw error;

// ===============================
// حفظ الموظفين المتعددين (نسخة آمنة 100%)
// ===============================

const multiRows = document.querySelectorAll(".multi-emp-row");
const multiInsert = [];

// 1️⃣ جمع البيانات + التحقق
multiRows.forEach(row => {

  const empId = row.querySelector(".multi-emp-select")?.value;
  const percentValue = row.querySelector(".multi-emp-percent")?.value;

  if (!empId) return;

  if (percentValue === "") {
    throw new Error("❌ يجب إدخال نسبة لكل موظف");
  }

  const percent = parseFloat(percentValue);

  if (isNaN(percent) || percent <= 0 || percent > 100) {
    throw new Error("❌ النسبة يجب أن تكون بين 1 و 100");
  }

  multiInsert.push({
    product_id: product.id,
    employee_id: empId,
    commission_percent: percent
  });
});


// إذا فيه موظفين مضافين → تحقق من النسب
if (multiInsert.length > 0) {

  // منع التكرار
  const employeeIds = multiInsert.map(e => e.employee_id);
  if (new Set(employeeIds).size !== employeeIds.length) {
    throw new Error("❌ لا يمكن اختيار نفس الموظف أكثر من مرة");
  }

  // تحقق مجموع النسب
  const totalPercent = multiInsert.reduce(
    (s, e) => s + e.commission_percent,
    0
  );

  if (Math.abs(totalPercent - 100) > 0.001) {
    throw new Error(
      `❌ مجموع النسب يجب أن يساوي 100% (الحالي: ${totalPercent}%)`
    );
  }

  // حذف القديم وإضافة الجديد
  await supabase
    .from("product_employees")
    .delete()
    .eq("product_id", product.id);

  await supabase
    .from("product_employees")
    .insert(multiInsert);

} else {

  // لا يوجد موظفين → نحذف أي ربط قديم فقط
  await supabase
    .from("product_employees")
    .delete()
    .eq("product_id", product.id);
}

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
  const { error: cErr } = await supabase
    .from("product_consumables")
    .insert(consumableRows);

  if (cErr) throw cErr;
}

    /* حفظ الإضافات المدفوعة (Add-ons) */
    if (editingItemId) {
      await supabase
        .from("product_addons")
        .delete()
        .eq("product_id", product.id);
    }

    const addonRows = [];
    document.querySelectorAll("#addonsBox .addon-row").forEach(row => {
      const name = row.querySelector(".addon-name")?.value.trim();
      const price = parseFloat(row.querySelector(".addon-price")?.value);

      if (name && !isNaN(price)) {
        const nameEn = row.querySelector(".addon-name-en")?.value.trim() || "";
        addonRows.push({ product_id: product.id, name, price, active: true,
          ...((nameEn || window.__hasVarEn) ? { name_en: nameEn || null } : {}) });
      }
    });

    if (addonRows.length) {
      const { error: addonErr } = await supabase
        .from("product_addons")
        .insert(addonRows);

      if (addonErr) throw addonErr;
    }

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
      active: true,
      ...(window.__hasVarEn ? { label_en: "Regular" } : {})
    });
  }

  if (cleanNumber(priceMedium) !== null) {
    variants.push({
      product_id: product.id,
      label: "وجبة",
      price: priceMedium,
      active: true,
      ...(window.__hasVarEn ? { label_en: "Meal" } : {})
    });
  }
}
      // 🥤 قائمة خيارات
      if (itemType === "choices") {
        choices.forEach(c => variants.push({
          product_id: product.id,
          label: c.label,
          price: c.price,
          active: true,
          ...((c.label_en || window.__hasVarEn) ? { label_en: c.label_en } : {})
        }));
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

  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("category", { ascending: true })   // 👈 ترتيب حسب القسم
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("LOAD ITEMS ERROR:", error);
    box.innerHTML = "<p>خطأ في تحميل الأصناف</p>";
    return;
  }

  window.__hasNameEn = !!(data && data.length && "name_en" in data[0]);
  window.__hasExtrasEn = !!(data && data.length && "extras_list_en" in data[0]);
  // أعمدة Stage 11 (الاسم الإنجليزي للخيارات والإضافات): نكتب فيها فقط لو موجودة
  try {
    const probe = await Promise.all([
      supabase.from("product_variants").select("label_en").limit(1),
      supabase.from("product_addons").select("name_en").limit(1)
    ]);
    window.__hasVarEn = !probe[0].error && !probe[1].error;
  } catch (e) { window.__hasVarEn = false; }

  if (!data || data.length === 0) {
    box.innerHTML = "<p>لا توجد أصناف</p>";
    return;
  }

  // 👇 نجمع الأصناف حسب القسم
  const groups = {
    food: [],
    drinks: [],
    sides: []
  };

  data.forEach(item => {
    if (groups[item.category]) {
      groups[item.category].push(item);
    }
  });

  // 👇 عرض كل قسم لحاله مع ترقيم منفصل
  Object.entries(groups).forEach(([category, items]) => {
    if (!items.length) return;

    const title = document.createElement("h4");
    title.textContent =
      category === "food" ? "🍔 الطعام" :
      category === "drinks" ? "🥤 المشروبات" :
      "🍟 الجانبية";

    box.appendChild(title);

    const section = document.createElement("div");
    section.className = "category-section";
    section.dataset.category = category;

    items.forEach((item, index) => {
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

      section.appendChild(div);
    });

    box.appendChild(section);

    // 👇 تفعيل السحب لكل قسم لحاله
    enableDragSort(section);
  });
}

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
  if (!confirm("هل أنت متأكد من الحذف؟ (يتحذف الصنف نهائياً، وسجل المبيعات القديمة يبقى كما هو)")) return;

  // نحذف التوابع ثم الصنف، ونوقف عند أول خطأ ونعرض سببه بدل ما يفشل بصمت
  const steps = ["product_variants", "product_consumables", "product_employees", "product_addons"];
  for (const t of steps) {
    const { error } = await supabase.from(t).delete().eq("product_id", id);
    if (error) {
      console.error("DELETE", t, error);
      return alert("❌ تعذر الحذف (" + t + "): " + error.message);
    }
  }
  const { error: pErr } = await supabase.from("products").delete().eq("id", id);
  if (pErr) {
    console.error("DELETE products", pErr);
    const fk = /foreign key|order_items/i.test(pErr.message || "");
    return alert(fk
      ? "❌ الصنف مرتبط بطلبات قديمة. شغّل ملف sql_stage13_safe_product_delete.sql في Supabase مرة وحدة وبعدها الحذف يشتغل."
      : "❌ تعذر الحذف: " + pErr.message);
  }

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
  
  // تحميل نسب الموظفين
const { data: multiEmployees } = await supabase
  .from("product_employees")
  .select("*")
  .eq("product_id", id);

const box = document.getElementById("multiEmployeesBox");
if (box) box.innerHTML = "";

if (multiEmployees?.length) {
  multiEmployees.forEach(me => {
    addMultiEmployeeRow();

    const lastRow = document.querySelector(
      "#multiEmployeesBox .multi-emp-row:last-child"
    );

    lastRow.querySelector(".multi-emp-select").value =
      me.employee_id;

    lastRow.querySelector(".multi-emp-percent").value =
      me.commission_percent;
  });
}

  // تعبئة البيانات الأساسية
  document.getElementById("itemName").value = item.name;
  const _enEl = document.getElementById("itemNameEn"); if (_enEl) _enEl.value = item.name_en || "";
  document.getElementById("itemCategory").value = item.category;
  document.getElementById("itemPrice").value = item.price || "";
  document.getElementById("itemExtras").value =
  item.extras_list || "";
  { const el = document.getElementById("itemExtrasEn"); if (el) el.value = item.extras_list_en || ""; }
  if ("extras_list_en" in item) window.__hasExtrasEn = true;
  document.getElementById("itemSpicy").checked = !!item.is_spicy;

  // ===== تحديد نوع الصنف (normal / burger / sizes) =====
  let itemType = "normal";

  if (item.has_variants) {
    const { data: variants } = await supabase
      .from("product_variants")
      .select("label")
      .eq("product_id", item.id);

    const known = ["وجبة", "عادي", "Small", "Medium", "Large"];
    if (variants?.some(v => !known.includes(v.label))) {
      itemType = "choices";
    } else if (variants?.some(v => v.label === "وجبة" || v.label === "عادي")) {
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
    item.has_variants && itemType !== "choices" ? "block" : "none";
  document.getElementById("choicesBox").style.display =
    itemType === "choices" ? "block" : "none";
  document.getElementById("itemPrice").style.display =
    itemType === "normal" ? "block" : "none";
  document.getElementById("choicesRows").innerHTML = "";

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

    if (itemType === "choices") {
      variants.forEach(v => addChoiceRow(v.label, v.price, v.label_en));
    }
    if (itemType !== "choices") variants?.forEach(v => {
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
// ===== تحميل ربط الموظف =====
await loadEmployees();

  // تحميل الإضافات المدفوعة
  const addonsBox = document.getElementById("addonsBox");
  if (addonsBox) addonsBox.innerHTML = "";

  const { data: addons } = await supabase
    .from("product_addons")
    .select("*")
    .eq("product_id", id);

  addons?.forEach(a => {
    addAddonRow();
    const lastRow = document.querySelector("#addonsBox .addon-row:last-child");
    lastRow.querySelector(".addon-name").value = a.name;
    lastRow.querySelector(".addon-price").value = a.price;
    const en = lastRow.querySelector(".addon-name-en"); if (en) en.value = a.name_en || "";
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ===============================
// نظام الموظفين المتعدد
// ===============================

window.addMultiEmployeeRow = function () {
  const box = document.getElementById("multiEmployeesBox");
  if (!box) return;

  const div = document.createElement("div");
  div.className = "multi-emp-row";
  div.style.marginBottom = "8px";

  div.innerHTML = `
    <select class="multi-emp-select">
      <option value="">اختر موظف</option>
      ${employeesList.map(e => `
        <option value="${e.id}">${e.name}</option>
      `).join("")}
    </select>

    <input 
      type="number" 
      class="multi-emp-percent"
      placeholder="النسبة %"
      min="0"
      max="100"
      style="width:90px"
    >

    <button type="button" onclick="this.parentElement.remove()">❌</button>
  `;

  box.appendChild(div);
};
/* ===============================
   أدوات
================================ */
function clearForm() {
  document.querySelector('input[name="itemType"][value="normal"]').checked = true;
  document.getElementById("itemName").value = "";
  const _en = document.getElementById("itemNameEn"); if (_en) _en.value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("itemImage").value = "";
  document.getElementById("variantsBox").style.display = "none";
  document.getElementById("choicesBox").style.display = "none";
  document.getElementById("choicesRows").innerHTML = "";
  document.getElementById("itemPrice").style.display = "block";
  document.getElementById("priceSmall").value = "";
  document.getElementById("priceMedium").value = "";
  document.getElementById("priceLarge").value = "";
  document.getElementById("itemExtras").value = "";
  { const el = document.getElementById("itemExtrasEn"); if (el) el.value = ""; }
  document.getElementById("itemSpicy").checked = false;
  
  const multiBox = document.getElementById("multiEmployeesBox");
  if (multiBox) multiBox.innerHTML = "";

  const addonsBox = document.getElementById("addonsBox");
  if (addonsBox) addonsBox.innerHTML = "";
}

/* ===============================
   تفعيل السحب وترتيب الأصناف
================================ */

let sortableInstances = [];

function enableDragSort(sectionElement) {
  const category = sectionElement.dataset.category;

  const sortable = new Sortable(sectionElement, {
    animation: 150,

    onEnd: async () => {
      const boxes = sectionElement.querySelectorAll(".order-box");

      for (let i = 0; i < boxes.length; i++) {
        const id = boxes[i].dataset.id;

        await supabase
  .from("products")
  .update({ sort_order: i + 1 })
  .eq("id", id);
      }

      console.log(`✅ تم حفظ ترتيب قسم ${category}`);
    }
  });

  sortableInstances.push(sortable);
}

window.goBack = () => location.href = "index.html";
