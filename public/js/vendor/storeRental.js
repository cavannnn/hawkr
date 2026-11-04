const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");
const stallId = new URLSearchParams(window.location.search).get("stallId");

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
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}


async function viewPdf(agreementId) {
  const viewer = window.open("", "_blank");
  if (viewer) viewer.document.write("Loading rental agreement…");

  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}/rental/${agreementId}/pdf`, { headers: authHeaders() });
    if (!res.ok) throw new Error("Failed to generate PDF.");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    if (viewer) {
      viewer.location.href = url;
    } else {
      showBanner("errorBanner", "Please allow pop-ups to view the agreement PDF.");
    }
    
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (err) {
    if (viewer) viewer.close();
    showBanner("errorBanner", err.message || "Failed to open PDF.");
  }
}

function rentalStatus(agreement) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(agreement.AgreementStartDate);
  const end = new Date(agreement.AgreementEndDate);
  const daysLeft = Math.ceil((end - today) / (1000 * 60 * 60 * 24));

  if (start > today) return { label: "Upcoming", cls: "upcoming", daysLeft };
  if (daysLeft < 0) return { label: "Expired", cls: "expired", daysLeft };
  if (daysLeft <= 30) return { label: "Renewal Due Soon", cls: "expiring", daysLeft };
  return { label: "Active", cls: "active", daysLeft };
}

function agreementCard(agreement, heading, extraActionsHtml) {
  const status = rentalStatus(agreement);
  const daysLeftText = status.daysLeft < 0
    ? Math.abs(status.daysLeft) + " day" + (Math.abs(status.daysLeft) === 1 ? "" : "s") + " overdue"
    : status.daysLeft + " day" + (status.daysLeft === 1 ? "" : "s") + " left";

  return `
    <div class="card rental-card">
      ${heading ? `<div class="card-title">${heading}</div>` : ""}
      <div class="rental-header">
        <div class="rental-price">${money(agreement.RentalPrice)} <span>/ month</span></div>
        <span class="rental-status-pill ${status.cls}">${status.label}</span>
      </div>
      <div class="rental-detail-grid">
        <div>
          <div class="rental-detail-label">Start Date</div>
          <div class="rental-detail-value">${formatDate(agreement.AgreementStartDate)}</div>
        </div>
        <div>
          <div class="rental-detail-label">End Date</div>
          <div class="rental-detail-value">${formatDate(agreement.AgreementEndDate)}</div>
        </div>
        <div>
          <div class="rental-detail-label">Time Remaining</div>
          <div class="rental-detail-value">${daysLeftText}</div>
        </div>
        <div>
          <div class="rental-detail-label">Contract Type</div>
          <div class="rental-detail-value">${escapeHtml(agreement.ContractType || "Fixed Price")}</div>
        </div>
        <div>
          <div class="rental-detail-label">Contract Name (Approved By)</div>
          <div class="rental-detail-value">${escapeHtml(agreement.ContractName || "—")}</div>
        </div>
      </div>
      <div class="rental-terms-label">Terms &amp; Conditions</div>
      <div class="rental-terms-box">${escapeHtml(agreement.AgreementTermsAndConditions)}</div>
      <div class="rental-actions">
        <button type="button" class="btn btn-primary pdf-view-btn" data-agreement-id="${agreement.AgreementId}">View / Print PDF</button>
        ${extraActionsHtml || ""}
      </div>
    </div>
  `;
}

let currentAgreement = null;

function renderRental(data) {
  const box = document.getElementById("rentalContent");
  currentAgreement = data.current;

  if (!data.current && !data.upcoming) {
    box.innerHTML = `
      <div class="card rental-empty">
        <div class="rental-empty-icon">📄</div>
        <div class="empty-state">No rental agreement is on file for this stall yet. Contact your hawker centre operator.</div>
      </div>
    `;
    return;
  }

  let html = "";

  if (data.current) {
    let currentExtra = "";
    if (!data.upcoming) {
      currentExtra = data.pendingRenewal
        ? `<span class="rental-pending-note">Renewal request sent — waiting for your operator to review it.</span>`
        : `<button type="button" class="btn btn-secondary" id="requestRenewalBtn">Request Renewal</button>`;
    }
    html += agreementCard(data.current, data.upcoming ? "Current Agreement" : null, currentExtra);
  }

  
  if (data.upcoming) {
    html += agreementCard(data.upcoming, data.current ? "Upcoming Agreement" : null);
  }

  box.innerHTML = html;

  const renewBtn = document.getElementById("requestRenewalBtn");
  if (renewBtn) renewBtn.addEventListener("click", () => renewModal.classList.add("show"));

  box.querySelectorAll(".pdf-view-btn").forEach(btn => {
    btn.addEventListener("click", () => viewPdf(btn.dataset.agreementId));
  });
}

function renderHistory(rows) {
  const tbody = document.getElementById("historyTableBody");
  const emptyMsg = document.getElementById("historyEmptyMsg");

  if (!rows || rows.length === 0) {
    tbody.innerHTML = "";
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  tbody.innerHTML = rows.map(a => `
    <tr>
      <td>${formatDate(a.AgreementStartDate)}</td>
      <td>${formatDate(a.AgreementEndDate)}</td>
      <td>${money(a.RentalPrice)}</td>
      <td>${escapeHtml(a.ContractType || "Fixed Price")}</td>
      <td>${escapeHtml(a.ContractName || "—")}</td>
      <td><span class="rental-status-pill ${a.status.toLowerCase()}">${a.status}</span></td>
      <td><button type="button" class="btn btn-secondary pdf-view-btn" data-agreement-id="${a.AgreementId}">PDF</button></td>
    </tr>
  `).join("");

  tbody.querySelectorAll(".pdf-view-btn").forEach(btn => {
    btn.addEventListener("click", () => viewPdf(btn.dataset.agreementId));
  });
}

async function loadRental() {
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
    
    const stallRes = await fetch(`/vendor/${userId}/stalls/${stallId}`, { headers: authHeaders() });
    if (stallRes.status === 401 || stallRes.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (stallRes.status === 404) {
      throw new Error("Store not found, or it doesn't belong to your account.");
    }
    if (!stallRes.ok) throw new Error("Failed to load this store.");
    const stall = await stallRes.json();

    const [rentalRes, historyRes] = await Promise.all([
      fetch(`/vendor/${userId}/stalls/${stallId}/rental`, { headers: authHeaders() }),
      fetch(`/vendor/${userId}/stalls/${stallId}/rental/history`, { headers: authHeaders() })
    ]);
    if (!rentalRes.ok) throw new Error("Failed to load rental agreement.");
    if (!historyRes.ok) throw new Error("Failed to load rental history.");

    renderRental(await rentalRes.json());
    renderHistory(await historyRes.json());
  } catch (err) {
    console.error("Error loading rental agreement:", err);
    document.getElementById("rentalContent").innerHTML = "";
    showBanner("errorBanner", err.message || "Something went wrong loading this stall's rental agreement.");
  }
}



const renewModal = document.getElementById("renewModal");

document.getElementById("cancelRenewBtn").addEventListener("click", () => renewModal.classList.remove("show"));
renewModal.addEventListener("click", (e) => {
  if (e.target === renewModal) renewModal.classList.remove("show");
});

document.getElementById("confirmRenewBtn").addEventListener("click", async () => {
  const confirmBtn = document.getElementById("confirmRenewBtn");
  confirmBtn.disabled = true;
  hideBanners();
  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}/rental/renew`, {
      method: "POST",
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to send renewal request.");

    renewModal.classList.remove("show");
    showBanner("successBanner", data.message);
    await loadRental();
  } catch (err) {
    renewModal.classList.remove("show");
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

loadRental();
