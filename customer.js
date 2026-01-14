/* ===============================
   Customer Entry
================================ */

window.startOrder = function () {
  const name  = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();

  if (!name || !phone) {
    alert("❌ الرجاء إدخال الاسم ورقم الهاتف");
    return;
  }

  // Session خاص بالعميل
  const customerSession = {
    id: crypto.randomUUID(),
    name,
    phone,
    created_at: new Date().toISOString()
  };

  localStorage.setItem("customer_session", JSON.stringify(customerSession));

  // الانتقال للمنيو
  window.location.href = "menu.html";
};