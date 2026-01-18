import { supabase } from "./supabase.js";
import { applyLang, setLang } from "./i18n.js";

window.setLang = setLang;

const PASSWORD = "1234";

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  applyLang();
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
  await loadItems();
};

/* ===============================
   رفع صورة (آمن)
================================ */
async function uploadImage(file) {
  try {
    const ext = file.name.split(".").pop();
    const path = `products/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${ext}`;

    const { error } = await supabase.storage
      .from("products")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (error) throw error;

    return supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
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
    const name = document.getElementById("itemName").value.trim();
    const category = document.getElementById("itemCategory").value;
    const imageFile = document.getElementById("itemImage")?.files[0];
    const hasVariants = document.getElementById("hasVariants").checked;

    const priceNormal = parseFloat(document.getElementById("itemPrice").value);
    const priceSmall  = parseFloat(document.getElementById("priceSmall").value);
    const priceMedium = parseFloat(document.getElementById("priceMedium").value);
    const priceLarge  = parseFloat(document.getElementById("priceLarge").value);

    if (!name) return alert("أدخل اسم الصنف");

    if (!hasVariants && isNaN(priceNormal))
      return alert("أدخل السعر");

    if (
      hasVariants &&
      isNaN(priceSmall) &&
      isNaN(priceMedium) &&
      isNaN(priceLarge)
    )
      return alert("أدخل سعر واحد على الأقل للأحجام");

    let image_url = null;
    if (imageFile) {
      image_url = await uploadImage(imageFile);
      if (!image_url) return;
    }
// ===== قراءة الإضافات الداخلية =====
const extrasRaw = document.getElementById("itemExtras")?.value || "";

const extras = extrasRaw
  .split("\n")
  .map(e => e.trim())
  .filter(e => e.length > 0);
  
    /* === إدخال الصنف === */
const { data: product, error } = await supabase
  .from("products")
  .insert({
    name,
    category,
    price: hasVariants ? null : priceNormal,
    has_variants: hasVariants,
    image_url,
    extras: extras, // ⭐ الإضافات الداخلية
    active: true
  })
      .select()
      .single();

    if (error) throw error;

    /* === إدخال الأحجام === */
    if (hasVariants) {
      const variants = [];

      if (!isNaN(priceSmall))
        variants.push({ product_id: product.id, label: "Small", price: priceSmall, active: true });

      if (!isNaN(priceMedium))
        variants.push({ product_id: product.id, label: "Medium", price: priceMedium, active: true });

      if (!isNaN(priceLarge))
        variants.push({ product_id: product.id, label: "Large", price: priceLarge, active: true });

      if (variants.length > 0) {
        const { error: vErr } = await supabase
          .from("product_variants")
          .insert(variants);

        if (vErr) throw vErr;
      }
    }

    clearForm();
    await loadItems();
    alert("✅ تم إضافة الصنف بنجاح");

  } catch (err) {
    console.error("ADD ITEM ERROR:", err);
    alert("❌ فشل إضافة الصنف (تحقق من الصلاحيات)");
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
    .order("created_at", { ascending: false });

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

/* ===============================
   أدوات
================================ */
function clearForm() {
  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("itemImage").value = "";
  document.getElementById("hasVariants").checked = false;
  document.getElementById("variantsBox").style.display = "none";
  document.getElementById("priceSmall").value = "";
  document.getElementById("priceMedium").value = "";
  document.getElementById("itemExtras").value = "";
  document.getElementById("priceLarge").value = "";
}

window.goBack = () => location.href = "index.html";