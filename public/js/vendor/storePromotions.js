const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");
const stallId = new URLSearchParams(window.location.search).get("stallId");

let menuItems = [];
let promotions = [];
let vouchers = [];
let stallName = "";
let deletingPromotionId = null;
let deletingVoucherId = null;

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

function toDateInput(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function discountLabel(item) {
  return item.discountType === "percentage"
    ? Number(item.discountValue) + "% OFF"
    : "$" + Number(item.discountValue).toFixed(2) + " OFF";
}


function computeStatus(item) {
  if (!item.isActive) return { label: "Inactive", cls: "inactive" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(item.startDate);
  const end = new Date(item.endDate);
  if (end < today) return { label: "Expired", cls: "expired" };
  if (start > today) return { label: "Scheduled", cls: "inactive" };
  return { label: "Active", cls: "active" };
}

function statusPillHtml(status) {
  return '<span class="status-toggle-pill ' + status.cls + '">' + status.label + '</span>';
}



function scopeLabel(promo) {
  if (promo.scopeType === "category") return "Category: " + escapeHtml(promo.scopeCategory);
  if (promo.scopeType === "items") {
    const names = (promo.scopeMenuIds || [])
      .map(id => menuItems.find(m => String(m.menuId) === String(id)))
      .filter(Boolean)
      .map(m => m.itemName);
    if (names.length === 0) return "0 items";
    if (names.length <= 2) return escapeHtml(names.join(", "));
    return escapeHtml(names.slice(0, 2).join(", ")) + " +" + (names.length - 2) + " more";
  }
  return "All Items";
}



function renderPromotionScopeFields() {
  const categorySelect = document.getElementById("promotionScopeCategorySelect");
  categorySelect.innerHTML = "";
  const categories = [...new Set(menuItems.map(m => m.category).filter(Boolean))];
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categorySelect.appendChild(option);
  });

  const itemsList = document.getElementById("promotionScopeItemsList");
  if (menuItems.length === 0) {
    itemsList.innerHTML = '<div class="scope-item-empty">No menu items yet.</div>';
  } else {
    itemsList.innerHTML = menuItems.map(item => `
      <label>
        <input type="checkbox" class="scope-item-checkbox" value="${item.menuId}">
        ${escapeHtml(item.itemName)}
      </label>
    `).join("");
  }
}

function updateScopeFieldVisibility() {
  const scopeType = document.querySelector('input[name="promotionScopeType"]:checked').value;
  document.getElementById("promotionScopeCategorySelect").hidden = scopeType !== "category";
  document.getElementById("promotionScopeItemsList").hidden = scopeType !== "items";
}

document.querySelectorAll('input[name="promotionScopeType"]').forEach(radio => {
  radio.addEventListener("change", updateScopeFieldVisibility);
});

function renderPromotionTable() {
  const body = document.getElementById("promotionTableBody");

  if (promotions.length === 0) {
    body.innerHTML = '<tr><td colspan="6" class="menu-empty">No promotions yet. Click "+ Add Promotion" to create your first one.</td></tr>';
    return;
  }

  body.innerHTML = promotions.map(promo => `
    <tr>
      <td class="item-name">${escapeHtml(promo.name)}</td>
      <td class="item-discount">${discountLabel(promo)}</td>
      <td class="item-scope">${scopeLabel(promo)}</td>
      <td>${statusPillHtml(computeStatus(promo))}</td>
      <td class="item-validity">${formatDate(promo.startDate)} – ${formatDate(promo.endDate)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-btn edit" data-promotion-id="${promo.promotionId}" title="Edit">✏️</button>
          <button type="button" class="icon-btn delete" data-promotion-id="${promo.promotionId}" title="Remove">🗑️</button>
        </div>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll(".icon-btn.edit").forEach(btn => {
    btn.addEventListener("click", () => openEditPromotionModal(btn.dataset.promotionId));
  });
  body.querySelectorAll(".icon-btn.delete").forEach(btn => {
    btn.addEventListener("click", () => openDeletePromotionModal(btn.dataset.promotionId));
  });
}



function usageLabel(voucher) {
  return voucher.usageLimit ? voucher.usageCount + " / " + voucher.usageLimit : voucher.usageCount + " / ∞";
}

function renderVoucherTable() {
  const body = document.getElementById("voucherTableBody");

  if (vouchers.length === 0) {
    body.innerHTML = '<tr><td colspan="7" class="menu-empty">No vouchers yet. Click "+ Add Voucher" to create your first one.</td></tr>';
    return;
  }

  body.innerHTML = vouchers.map(v => `
    <tr>
      <td class="item-id">${escapeHtml(v.code)}</td>
      <td class="item-discount">${discountLabel(v)}</td>
      <td>${v.minOrderAmount ? "$" + Number(v.minOrderAmount).toFixed(2) : "—"}</td>
      <td>${usageLabel(v)}</td>
      <td>${statusPillHtml(computeStatus(v))}</td>
      <td class="item-validity">${formatDate(v.startDate)} – ${formatDate(v.endDate)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="icon-btn edit" data-voucher-id="${v.voucherId}" title="Edit">✏️</button>
          <button type="button" class="icon-btn delete" data-voucher-id="${v.voucherId}" title="Remove">🗑️</button>
        </div>
      </td>
    </tr>
  `).join("");

  body.querySelectorAll(".icon-btn.edit").forEach(btn => {
    btn.addEventListener("click", () => openEditVoucherModal(btn.dataset.voucherId));
  });
  body.querySelectorAll(".icon-btn.delete").forEach(btn => {
    btn.addEventListener("click", () => openDeleteVoucherModal(btn.dataset.voucherId));
  });
}



async function loadPage() {
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
    if (!res.ok) throw new Error("Failed to load this store's promotions.");

    const data = await res.json();
    stallName = data.stallName;
    document.title = data.stallName + " — Add Promotion";
    document.getElementById("promotionModalStallName").textContent = data.stallName;
    menuItems = data.menu || [];
    promotions = data.promotions || [];
    vouchers = data.vouchers || [];

    renderPromotionScopeFields();
    renderPromotionTable();
    renderVoucherTable();
  } catch (err) {
    console.error("Error loading promotions:", err);
    document.getElementById("promotionTableBody").innerHTML =
      '<tr><td colspan="6" class="menu-empty">Could not load promotions.</td></tr>';
    document.getElementById("voucherTableBody").innerHTML =
      '<tr><td colspan="7" class="menu-empty">Could not load vouchers.</td></tr>';
    showBanner("errorBanner", err.message || "Something went wrong loading this page.");
  }
}



const promotionModal = document.getElementById("promotionModal");
const promotionForm = document.getElementById("promotionForm");

function updatePromotionPreview() {
  const type = document.getElementById("promotionDiscountType").value;
  const value = document.getElementById("promotionDiscountValue").value;
  const name = document.getElementById("promotionName").value;
  const description = document.getElementById("promotionDescription").value;

  document.getElementById("previewBadge").textContent = value
    ? (type === "percentage" ? value + "% OFF" : "$" + Number(value).toFixed(2) + " OFF")
    : "% OFF";
  document.getElementById("previewName").textContent = name || "Promotion Name";
  document.getElementById("previewDesc").textContent = description || "Description goes here.";
}

["promotionDiscountType", "promotionDiscountValue", "promotionName", "promotionDescription"].forEach(id => {
  document.getElementById(id).addEventListener("input", updatePromotionPreview);
});

function resetScopeFields() {
  document.querySelector('input[name="promotionScopeType"][value="all"]').checked = true;
  document.getElementById("promotionScopeCategorySelect").selectedIndex = 0;
  document.querySelectorAll(".scope-item-checkbox").forEach(cb => { cb.checked = false; });
  updateScopeFieldVisibility();
}

function openAddPromotionModal() {
  hideBanners();
  document.getElementById("promotionModalTitle").textContent = "Add Promotion";
  document.getElementById("editingPromotionId").value = "";
  promotionForm.reset();
  document.getElementById("promotionActive").checked = true;
  resetScopeFields();
  updatePromotionPreview();
  promotionModal.classList.add("show");
}

function openEditPromotionModal(promotionId) {
  hideBanners();
  const promo = promotions.find(p => String(p.promotionId) === String(promotionId));
  if (!promo) return;

  document.getElementById("promotionModalTitle").textContent = "Edit Promotion";
  document.getElementById("editingPromotionId").value = promo.promotionId;
  document.getElementById("promotionName").value = promo.name;
  document.getElementById("promotionDescription").value = promo.description || "";
  document.getElementById("promotionDiscountType").value = promo.discountType;
  document.getElementById("promotionDiscountValue").value = promo.discountValue;

  resetScopeFields();
  document.querySelector(`input[name="promotionScopeType"][value="${promo.scopeType}"]`).checked = true;
  if (promo.scopeType === "category") {
    document.getElementById("promotionScopeCategorySelect").value = promo.scopeCategory;
  } else if (promo.scopeType === "items") {
    const ids = (promo.scopeMenuIds || []).map(String);
    document.querySelectorAll(".scope-item-checkbox").forEach(cb => {
      cb.checked = ids.includes(cb.value);
    });
  }
  updateScopeFieldVisibility();

  document.getElementById("promotionStartDate").value = toDateInput(promo.startDate);
  document.getElementById("promotionEndDate").value = toDateInput(promo.endDate);
  document.getElementById("promotionActive").checked = !!promo.isActive;
  updatePromotionPreview();
  promotionModal.classList.add("show");
}

document.getElementById("addPromotionBtn").addEventListener("click", openAddPromotionModal);
document.getElementById("cancelPromotionBtn").addEventListener("click", () => promotionModal.classList.remove("show"));
promotionModal.addEventListener("click", (e) => {
  if (e.target === promotionModal) promotionModal.classList.remove("show");
});

promotionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanners();

  const promotionId = document.getElementById("editingPromotionId").value;
  const scopeType = document.querySelector('input[name="promotionScopeType"]:checked').value;
  const scopeMenuIds = Array.from(document.querySelectorAll(".scope-item-checkbox:checked")).map(cb => Number(cb.value));

  if (scopeType === "items" && scopeMenuIds.length === 0) {
    showBanner("errorBanner", "Pick at least one menu item for this promotion.");
    return;
  }

  const body = {
    name: document.getElementById("promotionName").value.trim(),
    description: document.getElementById("promotionDescription").value.trim(),
    discountType: document.getElementById("promotionDiscountType").value,
    discountValue: document.getElementById("promotionDiscountValue").value,
    scopeType,
    scopeCategory: scopeType === "category" ? document.getElementById("promotionScopeCategorySelect").value : null,
    scopeMenuIds: scopeType === "items" ? scopeMenuIds : [],
    isActive: document.getElementById("promotionActive").checked,
    startDate: document.getElementById("promotionStartDate").value,
    endDate: document.getElementById("promotionEndDate").value
  };

  const saveBtn = document.getElementById("savePromotionBtn");
  saveBtn.disabled = true;

  try {
    const url = promotionId
      ? `/vendor/${userId}/stalls/${stallId}/promotions/${promotionId}`
      : `/vendor/${userId}/stalls/${stallId}/promotions`;
    const res = await fetch(url, {
      method: promotionId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to save promotion.");

    promotionModal.classList.remove("show");
    showBanner("successBanner", promotionId ? "Promotion updated." : "Promotion created.");
    await loadPage();
  } catch (err) {
    showBanner("errorBanner", err.message);
  } finally {
    saveBtn.disabled = false;
  }
});



const deletePromotionModal = document.getElementById("deletePromotionModal");

function openDeletePromotionModal(promotionId) {
  hideBanners();
  deletingPromotionId = promotionId;
  deletePromotionModal.classList.add("show");
}

document.getElementById("cancelDeletePromotionBtn").addEventListener("click", () => {
  deletePromotionModal.classList.remove("show");
});
deletePromotionModal.addEventListener("click", (e) => {
  if (e.target === deletePromotionModal) deletePromotionModal.classList.remove("show");
});

document.getElementById("confirmDeletePromotionBtn").addEventListener("click", async () => {
  if (!deletingPromotionId) return;
  const confirmBtn = document.getElementById("confirmDeletePromotionBtn");
  confirmBtn.disabled = true;

  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}/promotions/${deletingPromotionId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to remove promotion.");

    deletePromotionModal.classList.remove("show");
    showBanner("successBanner", "Promotion removed.");
    await loadPage();
  } catch (err) {
    deletePromotionModal.classList.remove("show");
    showBanner("errorBanner", err.message);
  } finally {
    confirmBtn.disabled = false;
    deletingPromotionId = null;
  }
});



const voucherModal = document.getElementById("voucherModal");
const voucherForm = document.getElementById("voucherForm");

function openAddVoucherModal() {
  hideBanners();
  document.getElementById("voucherModalTitle").textContent = "Add Voucher";
  document.getElementById("editingVoucherId").value = "";
  voucherForm.reset();
  document.getElementById("voucherActive").checked = true;
  voucherModal.classList.add("show");
}

function openEditVoucherModal(voucherId) {
  hideBanners();
  const voucher = vouchers.find(v => String(v.voucherId) === String(voucherId));
  if (!voucher) return;

  document.getElementById("voucherModalTitle").textContent = "Edit Voucher";
  document.getElementById("editingVoucherId").value = voucher.voucherId;
  document.getElementById("voucherCode").value = voucher.code;
  document.getElementById("voucherDescription").value = voucher.description || "";
  document.getElementById("voucherDiscountType").value = voucher.discountType;
  document.getElementById("voucherDiscountValue").value = voucher.discountValue;
  document.getElementById("voucherMinOrder").value = voucher.minOrderAmount || "";
  document.getElementById("voucherUsageLimit").value = voucher.usageLimit || "";
  document.getElementById("voucherStartDate").value = toDateInput(voucher.startDate);
  document.getElementById("voucherEndDate").value = toDateInput(voucher.endDate);
  document.getElementById("voucherActive").checked = !!voucher.isActive;
  voucherModal.classList.add("show");
}

document.getElementById("addVoucherBtn").addEventListener("click", openAddVoucherModal);
document.getElementById("cancelVoucherBtn").addEventListener("click", () => voucherModal.classList.remove("show"));
voucherModal.addEventListener("click", (e) => {
  if (e.target === voucherModal) voucherModal.classList.remove("show");
});

voucherForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanners();

  const voucherId = document.getElementById("editingVoucherId").value;
  const body = {
    code: document.getElementById("voucherCode").value.trim().toUpperCase(),
    description: document.getElementById("voucherDescription").value.trim(),
    discountType: document.getElementById("voucherDiscountType").value,
    discountValue: document.getElementById("voucherDiscountValue").value,
    minOrderAmount: document.getElementById("voucherMinOrder").value || null,
    usageLimit: document.getElementById("voucherUsageLimit").value || null,
    isActive: document.getElementById("voucherActive").checked,
    startDate: document.getElementById("voucherStartDate").value,
    endDate: document.getElementById("voucherEndDate").value
  };

  const saveBtn = document.getElementById("saveVoucherBtn");
  saveBtn.disabled = true;

  try {
    const url = voucherId
      ? `/vendor/${userId}/stalls/${stallId}/vouchers/${voucherId}`
      : `/vendor/${userId}/stalls/${stallId}/vouchers`;
    const res = await fetch(url, {
      method: voucherId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to save voucher.");

    voucherModal.classList.remove("show");
    showBanner("successBanner", voucherId ? "Voucher updated." : "Voucher created.");
    await loadPage();
  } catch (err) {
    showBanner("errorBanner", err.message);
  } finally {
    saveBtn.disabled = false;
  }
});



const deleteVoucherModal = document.getElementById("deleteVoucherModal");

function openDeleteVoucherModal(voucherId) {
  hideBanners();
  deletingVoucherId = voucherId;
  deleteVoucherModal.classList.add("show");
}

document.getElementById("cancelDeleteVoucherBtn").addEventListener("click", () => {
  deleteVoucherModal.classList.remove("show");
});
deleteVoucherModal.addEventListener("click", (e) => {
  if (e.target === deleteVoucherModal) deleteVoucherModal.classList.remove("show");
});

document.getElementById("confirmDeleteVoucherBtn").addEventListener("click", async () => {
  if (!deletingVoucherId) return;
  const confirmBtn = document.getElementById("confirmDeleteVoucherBtn");
  confirmBtn.disabled = true;

  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}/vouchers/${deletingVoucherId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to remove voucher.");

    deleteVoucherModal.classList.remove("show");
    showBanner("successBanner", "Voucher removed.");
    await loadPage();
  } catch (err) {
    deleteVoucherModal.classList.remove("show");
    showBanner("errorBanner", err.message);
  } finally {
    confirmBtn.disabled = false;
    deletingVoucherId = null;
  }
});




document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  window.location.href = "/auth/login.html";
});

loadPage();
