import { supabase } from "./supabase.js";

const PASSWORD = "1234";

/* ===============================
   LOGIN
================================ */
window.login = async function () {
  const pass = document.getElementById("adminPass").value;

  if (pass !== PASSWORD) {
    alert("كلمة المرور غير صحيحة");
    return;
  }

  document.getElementById("loginBox").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";
  loadItems();
};

/* ===============================
   UPLOAD IMAGE
================================ */
async function uploadImage(file) {
  const ext = file.name.split(".").pop();
  const name = `products/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("products")
    .upload(name, file, { upsert: false });

  if (error) {
    alert("خطأ رفع الصورة");
    console.error(error);
    return null;
  }

  const { data } = supabase.storage
    .from("products")
    .getPublicUrl(name);

  return data.publicUrl;
}

/* ===============================
   ADD ITEM
================================ */
window.addItem = async function () {
  const name = itemName.value.trim();
  const category = itemCategory.value;
  const hasVariants = hasVariantsCheckbox.checked;
  const imageFile = itemImage.files[0];

  if (!name) return alert("أدخل اسم الصنف");

  let price = null;

  if (!hasVariants) {
    price = parseFloat(itemPrice.value);
    if (isNaN(price)) return alert("أدخل السعر");
  }

  let image_url = null;
  if (imageFile) {
    image_url = await uploadImage(imageFile);
    if (!image_url) return;
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name,
      category,
      price,
      has_variants: hasVariants,
      image_url,
      active: true
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  /* ===== VARIANTS ===== */
  if (hasVariants) {
    const variants = [];

    if (priceSmall.value)
      variants.push({ product_id: product.id, label: "Small", price: priceSmall.value });

    if (priceMedium.value)
      variants.push({ product_id: product.id, label: "Medium", price: priceMedium.value });

    if (priceLarge.value)
      variants.push({ product_id: product.id, label: "Large", price: priceLarge.value });

    if (!variants.length) {
      alert("أدخل سعر واحد على الأقل");
      return;
    }

    await supabase.from("product_variants").insert(variants);
  }

  alert("✅ تم حفظ الصنف");
  clearForm();
  loadItems();
};

/* ===============================
   LOAD ITEMS
================================ */
async function loadItems() {
  const box = document.getElementById("itemsList");
  box.innerHTML = "";

  const { data } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  data.forEach(i => {
    const div = document.createElement("div");
    div.className = "order-box";
    div.innerHTML = `
      <strong>${i.name}</strong><br>
      ${i.has_variants ? "أحجام متعددة" : i.price.toFixed(3) + " د.ب"}<br>
      <button onclick="toggleItem('${i.id}', ${!i.active})">
        ${i.active ? "تعطيل" : "تفعيل"}
      </button>
      <button onclick="deleteItem('${i.id}')">حذف</button>
    `;
    box.appendChild(div);
  });
}

/* ===============================
   HELPERS
================================ */
window.toggleItem = async (id, state) => {
  await supabase.from("products").update({ active: state }).eq("id", id);
  loadItems();
};

window.deleteItem = async id => {
  if (!confirm("متأكد؟")) return;
  await supabase.from("product_variants").delete().eq("product_id", id);
  await supabase.from("products").delete().eq("id", id);
  loadItems();
};

function clearForm() {
  itemName.value = "";
  itemPrice.value = "";
  itemImage.value = "";
  hasVariantsCheckbox.checked = false;
  variantsBox.style.display = "none";
  priceSmall.value = "";
  priceMedium.value = "";
  priceLarge.value = "";
}