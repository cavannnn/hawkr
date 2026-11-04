const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");

let orders = [];
let cancellingOrderId = null;

function authHeaders() {
  return { "Authorization": "Bearer " + token };
}

function showBanner(id, message) {
  const banner = document.getElementById(id);
  banner.textContent = message;
  banner.classList.add("show");
  if (id === "successBanner") {
    setTimeout(() => banner.classList.remove("show"), 4000);
  }
}

function hideBanners() {
  document.getElementById("errorBanner").classList.remove("show");
  document.getElementById("successBanner").classList.remove("show");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

function money(value) {
  return "$" + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(value) {
  return new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}



function stallLabel(order) {
  return escapeHtml(order.stall_name) + (order.stall_unit_number ? " · Unit " + escapeHtml(order.stall_unit_number) : "");
}

function itemsHtml(order) {
  return order.items.map(item =>
    "<div>" + escapeHtml(item.item_name) + " x" + item.quantity +
    (item.special_requests
      ? '<div class="order-card-item-note">↳ ' + escapeHtml(item.special_requests) + "</div>"
      : "") +
    "</div>"
  ).join("");
}

function totalHtml(order) {
  const discount = order.discount_amount == null ? 0 : Number(order.discount_amount);
  if (!(discount > 0)) return money(order.total_amount);
  const subtotal = Number(order.total_amount) + discount;
  return '<span class="order-card-subtotal">' + money(subtotal) + "</span>" +
         '<span class="order-card-discount">-' + money(discount) + "</span>" +
         "<span>" + money(order.total_amount) + "</span>";
}

function actionButtonHtml(order) {
  if (order.order_status === "pending") {
    return '<button type="button" class="btn btn-accept" data-order-id="' + order.order_id + '" data-next-status="preparing">Accept Order</button>';
  }
  if (order.order_status === "preparing") {
    return '<button type="button" class="btn btn-preparing" data-order-id="' + order.order_id + '" data-next-status="ready">Mark Ready</button>';
  }
  return '<button type="button" class="btn btn-ready" data-order-id="' + order.order_id + '" data-next-status="completed">Mark Completed</button>';
}

function orderCardHtml(order) {
  const isNew = order.order_status === "pending";
  return `
    <div class="order-card ${isNew ? "new" : ""}">
      <div class="order-card-stall">🏪 ${stallLabel(order)}</div>
      <div class="order-card-header">
        <span class="order-card-id">ORDER #${order.order_id}</span>
        <span class="order-card-time">${formatTime(order.order_date)}</span>
      </div>
      <div class="order-card-items">${itemsHtml(order)}</div>
      ${order.special_instructions ? `<div class="order-card-note">📝 ${escapeHtml(order.special_instructions)}</div>` : ""}
      <div class="order-card-customer">👤 ${escapeHtml(order.customer_name)}${order.customer_phone ? " · " + escapeHtml(order.customer_phone) : ""}</div>
      <div class="order-card-total">${totalHtml(order)}</div>
      <div class="order-card-actions">
        ${actionButtonHtml(order)}
        <button type="button" class="order-card-cancel-link" data-cancel-order-id="${order.order_id}">Cancel</button>
      </div>
    </div>
  `;
}

function renderColumn(bodyId, list) {
  const body = document.getElementById(bodyId);
  if (list.length === 0) {
    body.innerHTML = '<div class="empty-state">No orders here right now.</div>';
    return;
  }
  body.innerHTML = list.map(orderCardHtml).join("");

  body.querySelectorAll("[data-order-id]").forEach(btn => {
    btn.addEventListener("click", () => updateOrderStatus(btn.dataset.orderId, btn.dataset.nextStatus));
  });
  body.querySelectorAll("[data-cancel-order-id]").forEach(btn => {
    btn.addEventListener("click", () => openCancelModal(btn.dataset.cancelOrderId));
  });
}

function renderBoard() {
  const pending = orders.filter(o => o.order_status === "pending");
  const preparing = orders.filter(o => o.order_status === "preparing");
  const ready = orders.filter(o => o.order_status === "ready");

  document.getElementById("titlePending").textContent = "New Order " + pending.length;
  document.getElementById("titlePreparing").textContent = "Preparing " + preparing.length;
  document.getElementById("titleReady").textContent = "Ready for Collection " + ready.length;

  renderColumn("colPending", pending);
  renderColumn("colPreparing", preparing);
  renderColumn("colReady", ready);
}

async function loadOrders() {
  if (!token || !userId) {
    window.location.href = "/auth/login.html";
    return;
  }

  try {
    const res = await fetch(`/vendor/${userId}/orders?view=active`, { headers: authHeaders() });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (!res.ok) throw new Error("Failed to load orders.");

    const data = await res.json();
    orders = data.orders || [];
    renderBoard();
  } catch (err) {
    console.error("Error loading orders:", err);
    showBanner("errorBanner", err.message || "Something went wrong loading your orders.");
  }
}

async function updateOrderStatus(orderId, nextStatus) {
  hideBanners();
  try {
    const res = await fetch(`/vendor/${userId}/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: nextStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update this order.");
    await loadOrders();
  } catch (err) {
    showBanner("errorBanner", err.message);
  }
}



const cancelOrderModal = document.getElementById("cancelOrderModal");

function openCancelModal(orderId) {
  hideBanners();
  cancellingOrderId = orderId;
  cancelOrderModal.classList.add("show");
}

document.getElementById("cancelCancelBtn").addEventListener("click", () => {
  cancelOrderModal.classList.remove("show");
});
cancelOrderModal.addEventListener("click", (e) => {
  if (e.target === cancelOrderModal) cancelOrderModal.classList.remove("show");
});

document.getElementById("confirmCancelBtn").addEventListener("click", async () => {
  if (!cancellingOrderId) return;
  const confirmBtn = document.getElementById("confirmCancelBtn");
  confirmBtn.disabled = true;

  try {
    const res = await fetch(`/vendor/${userId}/orders/${cancellingOrderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status: "cancelled" })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to cancel this order.");

    cancelOrderModal.classList.remove("show");
    showBanner("successBanner", "Order cancelled.");
    await loadOrders();
  } catch (err) {
    cancelOrderModal.classList.remove("show");
    showBanner("errorBanner", err.message);
  } finally {
    confirmBtn.disabled = false;
    cancellingOrderId = null;
  }
});




document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  window.location.href = "/auth/login.html";
});

loadOrders();
setInterval(loadOrders, 20000);
