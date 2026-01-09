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
  loadItems();
};

/* ===== رفع صورة الصنف ===== */
async function uploadItemImage(file) {
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2)}.${fileExt}`;

  const { error } = await supabase.storage
    .from("products")
    .upload(fileName, file);

  if (error) {
    console.error("Image upload error:", error);
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
  const price = parseFloat(document.getElementById("itemPrice").value);
  const category = document.getElementById("itemCategory").value;
  const imageInput = document.getElementById("itemImage");
  const imageFile = imageInput?.files[0];

  if (!name || isNaN(price)) {
    alert(t("enter_name_price"));
    return;
  }

  let image_url = null;

  if (imageFile) {
    image_url = await uploadItemImage(imageFile);

    if (!image_url) {
      alert("فشل رفع الصورة");
      return;
    }
  }

  const { error } = await supabase.from("products").insert({
    name,
    price,
    category,
    image_url,
    active: true
  });

  if (error) {
    alert(t("save_item_error"));
    console.error(error);
    return;
  }

  // تنظيف الحقول
  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("itemImage").value = "";

  loadItems();
};

/* ===== عرض الأصناف ===== */
async function loadItems() {
  const box = document.getElementById("itemsList");
  box.innerHTML = "";

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
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
      ${
        item.image_url
          ? `<img src="${item.image_url}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-bottom:6px">`
          : ""
      }
      <strong>${item.name}</strong><br>
      ${item.price.toFixed(3)} د.ب — ${item.category}<br>
      ${t("status")}: ${
        item.active
          ? `<span style="color:green">${t("active")}</span>`
          : `<span style="color:red">${t("disabled")}</span>`
      }<br><br>

      ${
        item.active
          ? `<button class="btn warn" onclick="toggleItem('${item.id}', false)">
              🚫 ${t("disable")}
            </button>`
          : `<button class="btn success" onclick="toggleItem('${item.id}', true)">
              ✅ ${t("enable")}
            </button>`
      }

      <button class="btn danger" onclick="deleteItem('${item.id}')">
        🗑 ${t("delete_final")}
      </button>
    `;

    box.appendChild(div);
  });
}

/* ===== تعطيل / تفعيل ===== */
window.toggleItem = async function (id, state) {
  const { error } = await supabase
    .from("products")
    .update({ active: state })
    .eq("id", id);

  if (error) {
    alert(t("update_status_error"));
    console.error(error);
    return;
  }

  loadItems();
};

/* ===== حذف نهائي ===== */
window.deleteItem = async function (id) {
  if (!confirm(t("confirm_delete_item"))) return;

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    alert(t("delete_item_used"));
    console.error(error);
    return;
  }

  alert(t("item_deleted"));
  loadItems();
};

/* ===== رجوع ===== */
window.goBack = function () {
  window.location.href = "index.html";
};