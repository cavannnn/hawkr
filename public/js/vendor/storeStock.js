const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");
const stallId = new URLSearchParams(window.location.search).get("stallId");

const PAGE_SIZE = 10;
let currentPage = 1;
let stockItems = [];
let deletingStockItemId = null;

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

function formatQuantity(item) {
  const qty = Number(item.quantity || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
  return item.unit ? qty + " " + item.unit : qty;
}

function displayId(stockItemId) {
  return "#" + Number(stockItemId).toString(36).toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

function renderTable() {
  const body = document.getElementById("stockTableBody");

  if (stockItems.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="menu-empty">No stock items yet. Click "+ Add Stock Item" to create your first one.</td></tr>';
    renderPagination();
    return;
  }

  const totalPages = Math.max(1, Math.ceil(stockItems.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = stockItems.slice(start, start + PAGE_SIZE);

  body.innerHTML = pageItems.map(item => `
    <tr>
      <td class="item-id">${displayId(item.stockItemId)}</td>
      <td class="item-name">${escapeHtml(item.itemName)}${item.inStock ? "" : '<span class="item-out-of-stock">Out of stock</span>'}</td>
      <td class="item-quantity">${formatQuantity(item)}</td>
      <td class="item-description" title="${escapeHtml(item.description || "")}">${escapeHtml(item.description || "—")}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-btn edit" data-stock-item-id="${item.stockItemId}" title="Edit">✏️</button>
          <button type="button" class="icon-btn delete" data-stock-item-id="${item.stockItemId}" title="Remove">🗑️</button>
        </div>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll(".icon-btn.edit").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.stockItemId));
  });
  body.querySelectorAll(".icon-btn.delete").forEach(btn => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.stockItemId));
  });

  renderPagination();
}

function renderPagination() {
  const el = document.getElementById("pagination");
  const totalPages = Math.max(1, Math.ceil(stockItems.length / PAGE_SIZE));

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

async function loadStock() {
  if (!token || !userId) {
    window.location.href = "/auth/login.html";
    return;
  }
  if (!stallId) {
    showBanner("errorBanner", "No store selected.");
    return;
  }

  document.getElementById("backLink").href = `storeDetail.html?stallId=${stallId}`;

  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}`, { headers: authHeaders() });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (res.status === 404) {
      throw new Error("Store not found, or it doesn't belong to your account.");
    }
    if (!res.ok) throw new Error("Failed to load this store's inventory.");

    const data = await res.json();
    stockItems = data.stock || [];
    renderTable();
  } catch (err) {
    console.error("Error loading inventory:", err);
    document.getElementById("stockTableBody").innerHTML =
      '<tr><td colspan="5" class="menu-empty">Could not load the inventory.</td></tr>';
    showBanner("errorBanner", err.message || "Something went wrong loading the inventory.");
  }
}



const stockModal = document.getElementById("stockModal");
const stockForm = document.getElementById("stockForm");

function openAddModal() {
  hideBanners();
  document.getElementById("stockModalTitle").textContent = "Add Stock Item";
  document.getElementById("editingStockItemId").value = "";
  stockForm.reset();
  document.getElementById("stockInStock").checked = true;
  stockModal.classList.add("show");
}

function openEditModal(stockItemId) {
  hideBanners();
  const item = stockItems.find(i => String(i.stockItemId) === String(stockItemId));
  if (!item) return;

  document.getElementById("stockModalTitle").textContent = "Edit Stock Item";
  document.getElementById("editingStockItemId").value = item.stockItemId;
  document.getElementById("stockName").value = item.itemName;
  document.getElementById("stockQuantity").value = item.quantity;
  document.getElementById("stockUnit").value = item.unit || "";
  document.getElementById("stockCategory").value = item.category || "";
  document.getElementById("stockDescription").value = item.description || "";
  document.getElementById("stockInStock").checked = !!item.inStock;
  stockModal.classList.add("show");
}

document.getElementById("addStockBtn").addEventListener("click", openAddModal);
document.getElementById("cancelStockBtn").addEventListener("click", () => stockModal.classList.remove("show"));
stockModal.addEventListener("click", (e) => {
  if (e.target === stockModal) stockModal.classList.remove("show");
});

stockForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanners();

  const stockItemId = document.getElementById("editingStockItemId").value;
  const body = {
    itemName: document.getElementById("stockName").value.trim(),
    quantity: document.getElementById("stockQuantity").value,
    unit: document.getElementById("stockUnit").value.trim(),
    category: document.getElementById("stockCategory").value.trim(),
    description: document.getElementById("stockDescription").value.trim(),
    inStock: document.getElementById("stockInStock").checked
  };

  const saveBtn = document.getElementById("saveStockBtn");
  saveBtn.disabled = true;

  try {
    const url = stockItemId
      ? `/vendor/${userId}/stalls/${stallId}/stock/${stockItemId}`
      : `/vendor/${userId}/stalls/${stallId}/stock`;
    const res = await fetch(url, {
      method: stockItemId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to save stock item.");

    stockModal.classList.remove("show");
    showBanner("successBanner", stockItemId ? "Item updated." : "Item added.");
    await loadStock();
  } catch (err) {
    showBanner("errorBanner", err.message);
  } finally {
    saveBtn.disabled = false;
  }
});



const deleteStockModal = document.getElementById("deleteStockModal");

function openDeleteModal(stockItemId) {
  hideBanners();
  deletingStockItemId = stockItemId;
  deleteStockModal.classList.add("show");
}

document.getElementById("cancelDeleteStockBtn").addEventListener("click", () => {
  deleteStockModal.classList.remove("show");
});
deleteStockModal.addEventListener("click", (e) => {
  if (e.target === deleteStockModal) deleteStockModal.classList.remove("show");
});

document.getElementById("confirmDeleteStockBtn").addEventListener("click", async () => {
  if (!deletingStockItemId) return;
  const confirmBtn = document.getElementById("confirmDeleteStockBtn");
  confirmBtn.disabled = true;

  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}/stock/${deletingStockItemId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to remove item.");

    deleteStockModal.classList.remove("show");
    showBanner("successBanner", "Item removed.");
    await loadStock();
  } catch (err) {
    deleteStockModal.classList.remove("show");
    showBanner("errorBanner", err.message);
  } finally {
    confirmBtn.disabled = false;
    deletingStockItemId = null;
  }
});




document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  window.location.href = "/auth/login.html";
});

loadStock();
