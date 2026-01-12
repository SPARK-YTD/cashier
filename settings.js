import { supabase } from "./supabase.js";

const PASSWORD = "1234";

/* =========================
   تسجيل الدخول
========================= */
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

/* =========================
   رفع صورة
========================= */
async function uploadImage(file) {
  const ext = file.name.split(".").pop();
  const name = `products/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from("products")
    .upload(name, file);

  if (error) {
    alert(error.message);
    return null;
  }

  return supabase.storage.from("products").getPublicUrl(name).data.publicUrl;
}

/* =========================
   إضافة صنف
========================= */
window.addItem = async function () {
  const name = itemName.value.trim();
  const category = itemCategory.value;
  const hasVariants = hasVariantsCheckbox.checked;
  const imageFile = itemImage.files[0];

  if (!name) return alert("أدخل اسم الصنف");

  let price = parseFloat(itemPrice.value);
  if (!hasVariants && isNaN(price)) return alert("أدخل السعر");

  let image_url = null;
  if (imageFile) image_url = await uploadImage(imageFile);

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      name,
      category,
      price: hasVariants ? null : price,
      image_url,
      has_variants: hasVariants,
      active: true
    })
    .select()
    .single();

  if (error) {
    alert(error.message);
    return;
  }

  if (hasVariants) {
    const variants = [];
    if (priceSmall.value) variants.push({ product_id: product.id, label: "Small", price: priceSmall.value });
    if (priceMedium.value) variants.push({ product_id: product.id, label: "Medium", price: priceMedium.value });
    if (priceLarge.value) variants.push({ product_id: product.id, label: "Large", price: priceLarge.value });

    if (variants.length) {
      await supabase.from("product_variants").insert(variants);
    }
  }

  itemName.value = "";
  itemPrice.value = "";
  itemImage.value = "";
  hasVariantsCheckbox.checked = false;
  variantsBox.style.display = "none";
  priceSmall.value = priceMedium.value = priceLarge.value = "";

  loadItems();
};

/* =========================
   عرض الأصناف
========================= */
async function loadItems() {
  const box = document.getElementById("itemsList");
  box.innerHTML = "";

  const { data } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "order-box";
    div.innerHTML = `
      <strong>${item.name}</strong><br>
      ${item.has_variants ? "أحجام متعددة" : `${item.price.toFixed(3)} د.ب`}<br>
      الحالة: ${item.active ? "نشط" : "موقوف"}<br><br>
      <button class="btn ${item.active ? "danger" : "success"}"
        onclick="toggleItem('${item.id}', ${!item.active})">
        ${item.active ? "تعطيل" : "تفعيل"}
      </button>
      <button class="btn danger" onclick="deleteItem('${item.id}')">حذف</button>
    `;
    box.appendChild(div);
  });
}

/* =========================
   تفعيل / تعطيل
========================= */
window.toggleItem = async (id, state) => {
  await supabase.from("products").update({ active: state }).eq("id", id);
  loadItems();
};

/* =========================
   حذف
========================= */
window.deleteItem = async id => {
  if (!confirm("تأكيد الحذف؟")) return;
  await supabase.from("product_variants").delete().eq("product_id", id);
  await supabase.from("products").delete().eq("id", id);
  loadItems();
};

/* =========================
   رجوع
========================= */
window.goBack = () => location.href = "index.html";