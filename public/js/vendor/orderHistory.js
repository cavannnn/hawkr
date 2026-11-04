const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");

const PAGE_SIZE = 10;
let currentPage = 1;
let orders = [];

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

function formatDate(value) {
  return new Date(value).toLocaleString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function itemsSummary(order) {
  return order.items.map(item => escapeHtml(item.item_name) + " x" + item.quantity).join(", ");
}

function renderTable() {
  const body = document.getElementById("historyTableBody");

  if (orders.length === 0) {
    body.innerHTML = '<tr><td colspan="8" class="menu-empty">No completed or cancelled orders yet.</td></tr>';
    renderPagination();
    return;
  }

  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = orders.slice(start, start + PAGE_SIZE);

  body.innerHTML = pageItems.map(order => `
    <tr>
      <td class="stall-label">${escapeHtml(order.stall_name)}${order.stall_unit_number ? '<span class="stall-unit">Unit ' + escapeHtml(order.stall_unit_number) + '</span>' : ""}</td>
      <td class="item-id">#ORD${String(order.order_id).padStart(6, "0")}</td>
      <td>${escapeHtml(order.customer_name)}${order.customer_phone ? "<br><span class=\"item-description\">" + escapeHtml(order.customer_phone) + "</span>" : ""}</td>
      <td>${formatDate(order.order_date)}</td>
      <td class="item-list" title="${escapeHtml(itemsSummary(order))}">${escapeHtml(itemsSummary(order))}</td>
      <td class="item-price">${money(order.total_amount)}</td>
      <td><span class="payment-pill">${escapeHtml(order.payment_method || "cash")}</span></td>
      <td><span class="history-status-pill ${order.order_status}">${order.order_status}</span></td>
    </tr>
  `).join("");

  renderPagination();
}

function renderPagination() {
  const el = document.getElementById("pagination");
  const totalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));

  if (totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  let html = `<button type="button" data-page="prev" ${currentPage === 1 ? "disabled" : ""}>&lsaquo;</button>`;
  for (let p = 1; p <= totalPages; p++) {
    html += `<button type="button" data-page="${p}" class="${p === currentPage ? "active" : ""}">${p}</button>`;
  }
  html += `<button type="button" data-page="next" ${currentPage === totalPages ? "disabled" : ""}>&rsaquo;</button>`;

  el.innerHTML = html;
  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.dataset.page;
      if (val === "prev") currentPage = Math.max(1, currentPage - 1);
      else if (val === "next") currentPage = Math.min(totalPages, currentPage + 1);
      else currentPage = Number(val);
      renderTable();
    });
  });
}

async function loadHistory() {
  if (!token || !userId) {
    window.location.href = "/auth/login.html";
    return;
  }

  try {
    const res = await fetch(`/vendor/${userId}/orders?view=history`, { headers: authHeaders() });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (!res.ok) throw new Error("Failed to load order history.");

    const data = await res.json();
    orders = data.orders || [];
    renderTable();
  } catch (err) {
    console.error("Error loading order history:", err);
    document.getElementById("historyTableBody").innerHTML =
      '<tr><td colspan="8" class="menu-empty">Could not load order history.</td></tr>';
    showBanner("errorBanner", err.message || "Something went wrong loading your order history.");
  }
}



const clearHistoryModal = document.getElementById("clearHistoryModal");

document.getElementById("clearHistoryBtn").addEventListener("click", () => {
  hideBanners();
  clearHistoryModal.classList.add("show");
});
document.getElementById("cancelClearHistoryBtn").addEventListener("click", () => {
  clearHistoryModal.classList.remove("show");
});
clearHistoryModal.addEventListener("click", (e) => {
  if (e.target === clearHistoryModal) clearHistoryModal.classList.remove("show");
});

document.getElementById("confirmClearHistoryBtn").addEventListener("click", async () => {
  const confirmBtn = document.getElementById("confirmClearHistoryBtn");
  confirmBtn.disabled = true;

  try {
    const res = await fetch(`/vendor/${userId}/orders/history`, {
      method: "DELETE",
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to clear order history.");

    clearHistoryModal.classList.remove("show");
    showBanner("successBanner", data.message);
    currentPage = 1;
    await loadHistory();
  } catch (err) {
    clearHistoryModal.classList.remove("show");
    showBanner("errorBanner", err.message);
  } finally {
    confirmBtn.disabled = false;
  }
});




document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  window.location.href = "/auth/login.html";
});

loadHistory();
