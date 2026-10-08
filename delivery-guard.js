const session = sessionStorage.getItem("delivery_session");

if (!session) {
  window.location.href = "delivery-login.html";
} else {
  try {
    const account = JSON.parse(session);

    if (!account.id || !account.username || !account.token) {
      sessionStorage.removeItem("delivery_session");
      window.location.href = "delivery-login.html";
    }

  } catch {
    sessionStorage.removeItem("delivery_session");
    window.location.href = "delivery-login.html";
  }
}
