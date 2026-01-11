import { supabase } from "./supabase.js";
import { applyLang, setLang, t } from "./i18n.js";

window.setLang = setLang;

/* ===== تفعيل اللغة ===== */
document.addEventListener("DOMContentLoaded", () => {
  applyLang();
});

const PASSWORD = "1234";

/* ===== تسجيل الدخول ===== */
window.login = async function () {
  const pass = document.getElementById("adminPass").value;

  if (pass !== PASSWORD) {
    alert(t("wrong_password"));
    return;
  }

  document.getElementById("loginBox").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";
  await loadItems();
};

/* ===== رفع صورة الصنف ===== */
async function uploadItemImage(file) {
  const fileExt = file.name.split(".").pop();

  const fileName = `products/${Date.now()}-${Math.random()
    .toString(36)
    .substring(2)}.${fileExt}`;

  const { error } = await supabase.storage
    .from("products")
    .upload(fileName, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    console.error("UPLOAD ERROR:", error);
    alert(error.message);
    return null;
  }

  const { data } = supabase.storage
    .from("products")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

/* ===== إضافة صنف ===== */
window.addItem = async function () {
  const name = document.getElementById("itemName").value.trim();
  const category = document.getElementById("itemCategory").value;
  const imageFile = document.getElementById("itemImage")?.files[0];

  const hasVariants = document.getElementById("hasVariants")?.checked;

  const priceNormal = parseFloat(document.getElementById("itemPrice").value);
  const priceSmall = parseFloat(document.getElementById("priceSmall")?.value);
  const priceMedium = parseFloat(document.getElementById("priceMedium")?.value);
  const priceLarge = parseFloat(document.getElementById("priceLarge")?.value);

  if (!name) {
    alert("أدخل اسم الصنف");
    return;
  }

  if (!hasVariants && isNaN(priceNormal)) {
    alert("أدخل السعر");
    return;
  }

  if (hasVariants && isNaN(priceSmall) && isNaN(priceMedium) && isNaN(priceLarge)) {
    alert("أدخل سعر واحد على الأقل للأحجام");
    return;
  }

  let image_url = null;
  if (imageFile) {
    image_url = await uploadItemImage(imageFile);
    if (!image_url) return;
  }

  /* === إدخال الصنف === */
  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name,
      category,
      price: hasVariants ? null : priceNormal,
      image_url,
      has_variants: hasVariants,
      active: true
    })
    .select()
    .single();

  if (error) {
    console.error("INSERT PRODUCT ERROR:", error);
    alert(error.message);
    return;
  }

  /* === إدخال الأحجام === */
  if (hasVariants) {
    const variants = [];

    if (!isNaN(priceSmall))
      variants.push({ product_id: product.id, label: "Small", price: priceSmall });

    if (!isNaN(priceMedium))
      variants.push({ product_id: product.id, label: "Medium", price: priceMedium });

    if (!isNaN(priceLarge))
      variants.push({ product_id: product.id, label: "Large", price: priceLarge });

    const { error: variantError } = await supabase
      .from("product_variants")
      .insert(variants);

    if (variantError) {
      console.error("INSERT VARIANTS ERROR:", variantError);
      alert("تم حفظ الصنف لكن حدث خطأ في الأحجام");
    }
  }

  /* === تنظيف الحقول === */
  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("itemImage").value = "";
  document.getElementById("hasVariants").checked = false;
  document.getElementById("priceSmall").value = "";
  document.getElementById("priceMedium").value = "";
  document.getElementById("priceLarge").value = "";
  document.getElementById("variantsBox").style.display = "none";

  await loadItems();
};

/* ===== عرض الأصناف ===== */
async function loadItems() {
  const box = document.getElementById("itemsList");
  if (!box) return;

  box.innerHTML = "";

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("LOAD ITEMS ERROR:", error);
    box.innerHTML = `<p>${t("load_items_error")}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    box.innerHTML = `<p>${t("no_items")}</p>`;
    return;
  }

  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "order-box";

    div.innerHTML = `
      ${item.image_url ? `<img src="${item.image_url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-bottom:6px">` : ""}
      <strong>${item.name}</strong><br>
      ${item.has_variants ? "متعدد الأحجام" : `${Number(item.price).toFixed(3)} د.ب`} — ${item.category}<br>
      الحالة: ${item.active ? "نشط" : "موقوف"}<br><br>

      ${
        item.active
          ? `<button class="btn warn" onclick="toggleItem('${item.id}', false)">🚫 تعطيل</button>`
          : `<button class="btn success" onclick="toggleItem('${item.id}', true)">✅ تفعيل</button>`
      }

      <button class="btn danger" onclick="deleteItem('${item.id}')">🗑 حذف</button>
    `;

    box.appendChild(div);
  });
}

/* ===== تعطيل / تفعيل ===== */
window.toggleItem = async function (id, state) {
  await supabase.from("products").update({ active: state }).eq("id", id);
  await loadItems();
};

/* ===== حذف ===== */
window.deleteItem = async function (id) {
  if (!confirm("هل أنت متأكد؟")) return;

  await supabase.from("product_variants").delete().eq("product_id", id);
  await supabase.from("products").delete().eq("id", id);

  await loadItems();
};

/* ===== رجوع ===== */
window.goBack = function () {
  window.location.href = "index.html";
};