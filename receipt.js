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