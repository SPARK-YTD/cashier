const data = JSON.parse(localStorage.getItem("receiptData"));

if (!data) {
  alert("لا توجد بيانات فاتورة");
} else {
  document.getElementById("invoiceNo").textContent = data.invoiceNo;
  document.getElementById("date").textContent = data.date;
  document.getElementById("total").textContent = data.total.toFixed(3);

  const tbody = document.getElementById("items");

  data.items.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>${(item.qty * item.price).toFixed(3)}</td>
    `;
    tbody.appendChild(tr);
  });
}
document.addEventListener("DOMContentLoaded", () => {
  const data = JSON.parse(localStorage.getItem("receiptData"));

  if (!data) return;

  const list = document.getElementById("receiptItems");
  let html = "";
  let total = 0;

  data.items.forEach(i => {
    const sum = i.qty * i.price;
    total += sum;
    html += `
      <tr>
        <td>${i.name}</td>
        <td>${i.qty}</td>
        <td>${sum.toFixed(3)}</td>
      </tr>
    `;
  });

  list.innerHTML = html;
  document.getElementById("receiptTotal").textContent = total.toFixed(3) + " د.ب";
  document.getElementById("receiptDate").textContent = data.date;
});