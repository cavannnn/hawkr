const token = localStorage.getItem("authToken");
const role = localStorage.getItem("userRole");

function authHeaders() {
  return { "Authorization": "Bearer " + token };
}

function money(value) {
  return "$" + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showMsg(message, isError) {
  const list = document.getElementById("pendingList");
  const msg = document.createElement("p");
  msg.className = "empty-msg";
  msg.style.color = isError ? "var(--danger)" : "";
  msg.textContent = message;
  list.prepend(msg);
  setTimeout(() => msg.remove(), 4000);
}

function renderRequests(requests) {
  const list = document.getElementById("pendingList");

  if (requests.length === 0) {
    list.innerHTML = '<p class="empty-msg">No renewal requests waiting for review.</p>';
    return;
  }

  list.innerHTML = requests.map(req => {
    const requestedDate = new Date(req.RequestedAt).toLocaleDateString();
    const endDate = new Date(req.currentEndDate).toLocaleDateString();

    return (
      '<div class="request-row">' +
        '<div class="request-body">' +
          '<div class="request-name">' + req.stallName + "</div>" +
          '<div class="request-sub">Vendor: ' + req.vendorName + " · " + req.centreName +
            " · Current rate " + money(req.currentRentalPrice) + "/mo, ends " + endDate +
            " · Requested " + requestedDate + "</div>" +
        "</div>" +
        '<div class="request-actions">' +
          '<button class="save-btn" data-approve="' + req.RenewalRequestId + '" data-price="' + req.currentRentalPrice + '">Approve</button>' +
          '<button class="delete-btn" data-reject="' + req.RenewalRequestId + '">Reject</button>' +
        "</div>" +
      "</div>"
    );
  }).join("");

  list.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", () => openApproveModal(Number(btn.dataset.approve), btn.dataset.price));
  });
  list.querySelectorAll("[data-reject]").forEach(btn => {
    btn.addEventListener("click", () => openRejectModal(Number(btn.dataset.reject)));
  });
}

async function loadRequests() {
  if (!token || role !== "operator") {
    document.getElementById("pendingList").innerHTML =
      '<p class="empty-msg">You must be logged in as an operator to view this page.</p>';
    return;
  }

  try {
    const res = await fetch("/operator/rental-renewals", { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (!res.ok) throw new Error("Failed to load renewal requests.");

    const requests = await res.json();
    renderRequests(requests);
  } catch (err) {
    console.error("Error loading renewal requests:", err);
    document.getElementById("pendingList").innerHTML = '<p class="empty-msg">' + err.message + "</p>";
  }
}

let approvingRenewalId = null;
const approveModal = document.getElementById("approveModal");

function openApproveModal(renewalId, currentPrice) {
  approvingRenewalId = renewalId;
  document.getElementById("approveRentalPrice").value = currentPrice || "";
  approveModal.classList.add("show");
}

function closeApproveModal() {
  approveModal.classList.remove("show");
  approvingRenewalId = null;
}

document.getElementById("closeApproveModalBtn").addEventListener("click", closeApproveModal);
document.getElementById("cancelApproveBtn").addEventListener("click", closeApproveModal);
approveModal.addEventListener("click", (e) => {
  if (e.target === approveModal) closeApproveModal();
});

document.getElementById("confirmApproveBtn").addEventListener("click", async () => {
  if (!approvingRenewalId) return;
  const rentalPrice = document.getElementById("approveRentalPrice").value;
  if (!rentalPrice || Number(rentalPrice) <= 0) {
    showMsg("Enter a monthly rental rate greater than 0.", true);
    return;
  }

  try {
    const res = await fetch("/operator/rental-renewals/" + approvingRenewalId + "/approve", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ rentalPrice })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not approve.");
    closeApproveModal();
    showMsg(data.message, false);
    loadRequests();
  } catch (err) {
    closeApproveModal();
    showMsg(err.message, true);
  }
});

let rejectingRenewalId = null;
const rejectModal = document.getElementById("rejectModal");

function openRejectModal(renewalId) {
  rejectingRenewalId = renewalId;
  document.getElementById("rejectNote").value = "";
  rejectModal.classList.add("show");
}

function closeRejectModal() {
  rejectModal.classList.remove("show");
  rejectingRenewalId = null;
}

document.getElementById("closeRejectModalBtn").addEventListener("click", closeRejectModal);
document.getElementById("cancelRejectBtn").addEventListener("click", closeRejectModal);
rejectModal.addEventListener("click", (e) => {
  if (e.target === rejectModal) closeRejectModal();
});

document.getElementById("confirmRejectBtn").addEventListener("click", async () => {
  if (!rejectingRenewalId) return;
  const note = document.getElementById("rejectNote").value;

  try {
    const res = await fetch("/operator/rental-renewals/" + rejectingRenewalId + "/reject", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ reviewNote: note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not reject.");
    closeRejectModal();
    showMsg(data.message, false);
    loadRequests();
  } catch (err) {
    closeRejectModal();
    showMsg(err.message, true);
  }
});

loadRequests();
