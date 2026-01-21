import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

const PASSWORD = "1234";
let editingItemId = null;
/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  applyLang();

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
  // ✏️ تعديل
  query = supabase
    .from("products")
    .update({
      name,
      category,
      price: hasVariants ? null : cleanNumber(priceNormal),
      has_variants: hasVariants,
      image_url,
      extras_list: extras.join("\n")
    })
    .eq("id", editingItemId);
} else {
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
      active: true,
      sort_order: Date.now()
    });
}

    const { data: product, error } = await query.select().single();
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

  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "order-box";

    div.innerHTML = `
      ${
        item.image_url
          ? `<img src="${item.image_url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-bottom:6px">`
          : ""
      }
      <strong>${item.name}</strong><br>
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
  document.getElementById("itemExtras").value = "";
  document.getElementById("priceLarge").value = "";
}

window.goBack = () => location.href = "index.html";