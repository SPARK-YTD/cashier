import { supabase } from "./supabase.js";
import { applyLang } from "./i18n.js";

const PASSWORD = "1234";

document.addEventListener("DOMContentLoaded", () => {
  applyLang();
});

/* ===== LOGIN ===== */
window.login = async function () {
  const pass = document.getElementById("adminPass").value.trim();
  if (pass !== PASSWORD) {
    alert("❌ كلمة المرور غير صحيحة");
    return;
  }

  document.getElementById("loginBox").style.display = "none";
  document.getElementById("adminPanel").style.display = "block";

  await loadItems();
};

/* ===== IMAGE UPLOAD ===== */
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

  const { data } = supabase.storage
    .from("products")
    .getPublicUrl(name);

  return data.publicUrl;
}

/* ===== ADD ITEM ===== */
window.addItem = async function () {
  const name = itemName.value.trim();
  const category = itemCategory.value;
  const hasVariants = document.getElementById("hasVariants").checked;

  if (!name) return alert("أدخل اسم الصنف");

  let image_url = null;
  if (itemImage.files[0]) {
    image_url = await uploadImage(itemImage.files[0]);
    if (!image_url) return;
  }

  const price = hasVariants ? null : Number(itemPrice.value);
  if (!hasVariants && !price) return alert("أدخل السعر");

  const { data: product } = await supabase
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

  if (hasVariants) {
    const variants = [];
    if (priceSmall.value) variants.push({ product_id: product.id, label: "Small", price: priceSmall.value });
    if (priceMedium.value) variants.push({ product_id: product.id, label: "Medium", price: priceMedium.value });
    if (priceLarge.value) variants.push({ product_id: product.id, label: "Large", price: priceLarge.value });

    await supabase.from("product_variants").insert(variants);
  }

  itemName.value = "";
  itemPrice.value = "";
  itemImage.value = "";
  hasVariants.checked = false;
  variantsBox.style.display = "none";

  await loadItems();
};

/* ===== LOAD ITEMS ===== */
async function loadItems() {
  itemsList.innerHTML = "";

  const { data } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  data.forEach(item => {
    const div = document.createElement("div");
    div.className = "order-box";
    div.innerHTML = `
      <strong>${item.name}</strong><br>
      ${item.active ? "🟢 نشط" : "🔴 موقوف"}<br>
      <button class="btn warn" onclick="toggleItem('${item.id}',${!item.active})">
        ${item.active ? "تعطيل" : "تفعيل"}
      </button>
      <button class="btn danger" onclick="deleteItem('${item.id}')">حذف</button>
    `;
    itemsList.appendChild(div);
  });
}

/* ===== TOGGLE ===== */
window.toggleItem = async (id, state) => {
  await supabase.from("products").update({ active: state }).eq("id", id);
  loadItems();
};

/* ===== DELETE ===== */
window.deleteItem = async id => {
  if (!confirm("متأكد من الحذف؟")) return;
  await supabase.from("product_variants").delete().eq("product_id", id);
  await supabase.from("products").delete().eq("id", id);
  loadItems();
};

/* ===== BACK ===== */
window.goBack = () => location.href = "index.html";