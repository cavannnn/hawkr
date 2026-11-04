const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");
const stallId = new URLSearchParams(window.location.search).get("stallId");

const PAGE_SIZE = 10;
let currentPage = 1;
let menuItems = [];
let deletingMenuId = null;

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

function money(value) {
  return "$" + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function displayId(menuId) {
  return "#" + Number(menuId).toString(36).toUpperCase();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

function renderTable() {
  const body = document.getElementById("menuTableBody");

  if (menuItems.length === 0) {
    body.innerHTML = '<tr><td colspan="5" class="menu-empty">No menu items yet. Click "+ Add Item" to create your first one.</td></tr>';
    renderPagination();
    return;
  }

  const totalPages = Math.max(1, Math.ceil(menuItems.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = menuItems.slice(start, start + PAGE_SIZE);

  body.innerHTML = pageItems.map(item => `
    <tr>
      <td class="item-id">${displayId(item.menuId)}</td>
      <td class="item-name">${escapeHtml(item.itemName)}${item.available ? "" : '<span class="item-unavailable">Hidden</span>'}</td>
      <td class="item-price">${money(item.price)}</td>
      <td class="item-description" title="${escapeHtml(item.description || "")}">${escapeHtml(item.description || "—")}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-btn edit" data-menu-id="${item.menuId}" title="Edit">✏️</button>
          <button type="button" class="icon-btn delete" data-menu-id="${item.menuId}" title="Remove">🗑️</button>
        </div>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll(".icon-btn.edit").forEach(btn => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.menuId));
  });
  body.querySelectorAll(".icon-btn.delete").forEach(btn => {
    btn.addEventListener("click", () => openDeleteModal(btn.dataset.menuId));
  });

  renderPagination();
}

function renderPagination() {
  const el = document.getElementById("pagination");
  const totalPages = Math.max(1, Math.ceil(menuItems.length / PAGE_SIZE));

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

async function loadMenu() {
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
    if (!res.ok) throw new Error("Failed to load this store's menu.");

    const data = await res.json();
    menuItems = data.menu || [];
    renderTable();
  } catch (err) {
    console.error("Error loading menu:", err);
    document.getElementById("menuTableBody").innerHTML =
      '<tr><td colspan="5" class="menu-empty">Could not load the menu.</td></tr>';
    showBanner("errorBanner", err.message || "Something went wrong loading the menu.");
  }
}



const itemModal = document.getElementById("itemModal");
const itemForm = document.getElementById("itemForm");

function openAddModal() {
  hideBanners();
  document.getElementById("itemModalTitle").textContent = "Add Item";
  document.getElementById("editingMenuId").value = "";
  itemForm.reset();
  document.getElementById("itemAvailable").checked = true;
  itemModal.classList.add("show");
}

function openEditModal(menuId) {
  hideBanners();
  const item = menuItems.find(i => String(i.menuId) === String(menuId));
  if (!item) return;

  document.getElementById("itemModalTitle").textContent = "Edit Item";
  document.getElementById("editingMenuId").value = item.menuId;
  document.getElementById("itemName").value = item.itemName;
  document.getElementById("itemPrice").value = item.price;
  document.getElementById("itemCategory").value = item.category || "";
  document.getElementById("itemDescription").value = item.description || "";
  document.getElementById("itemAvailable").checked = !!item.available;
  itemModal.classList.add("show");
}

document.getElementById("addItemBtn").addEventListener("click", openAddModal);
document.getElementById("cancelItemBtn").addEventListener("click", () => itemModal.classList.remove("show"));
itemModal.addEventListener("click", (e) => {
  if (e.target === itemModal) itemModal.classList.remove("show");
});

itemForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanners();

  const menuId = document.getElementById("editingMenuId").value;
  const body = {
    itemName: document.getElementById("itemName").value.trim(),
    price: document.getElementById("itemPrice").value,
    category: document.getElementById("itemCategory").value.trim(),
    description: document.getElementById("itemDescription").value.trim(),
    available: document.getElementById("itemAvailable").checked
  };

  const saveBtn = document.getElementById("saveItemBtn");
  saveBtn.disabled = true;

  try {
    const url = menuId
      ? `/vendor/${userId}/stalls/${stallId}/menu/${menuId}`
      : `/vendor/${userId}/stalls/${stallId}/menu`;
    const res = await fetch(url, {
      method: menuId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to save menu item.");

    itemModal.classList.remove("show");
    showBanner("successBanner", menuId ? "Item updated." : "Item added.");
    await loadMenu();
  } catch (err) {
    showBanner("errorBanner", err.message);
  } finally {
    saveBtn.disabled = false;
  }
});



const deleteItemModal = document.getElementById("deleteItemModal");

function openDeleteModal(menuId) {
  hideBanners();
  deletingMenuId = menuId;
  deleteItemModal.classList.add("show");
}

document.getElementById("cancelDeleteItemBtn").addEventListener("click", () => {
  deleteItemModal.classList.remove("show");
});
deleteItemModal.addEventListener("click", (e) => {
  if (e.target === deleteItemModal) deleteItemModal.classList.remove("show");
});

document.getElementById("confirmDeleteItemBtn").addEventListener("click", async () => {
  if (!deletingMenuId) return;
  const confirmBtn = document.getElementById("confirmDeleteItemBtn");
  confirmBtn.disabled = true;

  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}/menu/${deletingMenuId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to remove item.");

    deleteItemModal.classList.remove("show");
    showBanner("successBanner", "Item removed.");
    await loadMenu();
  } catch (err) {
    deleteItemModal.classList.remove("show");
    showBanner("errorBanner", err.message);
  } finally {
    confirmBtn.disabled = false;
    deletingMenuId = null;
  }
});




document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  window.location.href = "/auth/login.html";
});

loadMenu();
