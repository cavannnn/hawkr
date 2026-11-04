const token = localStorage.getItem("authToken");
const role = localStorage.getItem("userRole");

function authHeaders() {
  return { "Authorization": "Bearer " + token };
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
    list.innerHTML = '<p class="empty-msg">No requests waiting for review.</p>';
    return;
  }

  list.innerHTML = requests.map(req => {
    const date = new Date(req.requestedAt).toLocaleDateString();
    const desc = req.description ? '<div class="request-sub">' + req.description + "</div>" : "";
    const hours = req.operatingHours ? " · " + req.operatingHours : "";
    const grade = req.hygieneGrade ? ' <span class="pill grade-' + req.hygieneGrade + '">Grade ' + req.hygieneGrade + "</span>" : "";
    const thumb = req.imageUrl
      ? '<div class="request-thumb"><img src="' + req.imageUrl + '" alt="" onerror="this.parentElement.style.display=\'none\'"></div>'
      : "";

    return (
      '<div class="request-row">' +
        thumb +
        '<div class="request-body">' +
          '<div class="request-name">' + req.stallName + grade + "</div>" +
          '<div class="request-sub">Vendor: ' + req.username + " · " + req.centreName +
            " · Unit " + req.unitNumber + hours + " · " + date + "</div>" +
          desc +
        "</div>" +
        '<div class="request-actions">' +
          '<button class="save-btn" data-approve="' + req.requestId + '">Approve</button>' +
          '<button class="delete-btn" data-reject="' + req.requestId + '">Reject</button>' +
        "</div>" +
      "</div>"
    );
  }).join("");

  list.querySelectorAll("[data-approve]").forEach(btn => {
    btn.addEventListener("click", () => openApproveModal(Number(btn.dataset.approve)));
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
    const res = await fetch("/operator/stall-requests", { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (!res.ok) throw new Error("Failed to load requests.");

    const requests = await res.json();
    renderRequests(requests);
  } catch (err) {
    console.error("Error loading requests:", err);
    document.getElementById("pendingList").innerHTML = '<p class="empty-msg">' + err.message + "</p>";
  }
}

let approvingRequestId = null;
const approveModal = document.getElementById("approveModal");

function openApproveModal(requestId) {
  approvingRequestId = requestId;
  document.getElementById("approveRentalPrice").value = "";
  approveModal.classList.add("show");
}

function closeApproveModal() {
  approveModal.classList.remove("show");
  approvingRequestId = null;
}

document.getElementById("closeApproveModalBtn").addEventListener("click", closeApproveModal);
document.getElementById("cancelApproveBtn").addEventListener("click", closeApproveModal);
approveModal.addEventListener("click", (e) => {
  if (e.target === approveModal) closeApproveModal();
});

document.getElementById("confirmApproveBtn").addEventListener("click", async () => {
  if (!approvingRequestId) return;
  const rentalPrice = document.getElementById("approveRentalPrice").value;
  if (!rentalPrice || Number(rentalPrice) <= 0) {
    showMsg("Enter a monthly rental rate greater than 0.", true);
    return;
  }

  try {
    const res = await fetch("/operator/stall-requests/" + approvingRequestId + "/approve", {
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

let rejectingRequestId = null;
const rejectModal = document.getElementById("rejectModal");

function openRejectModal(requestId) {
  rejectingRequestId = requestId;
  document.getElementById("rejectNote").value = "";
  rejectModal.classList.add("show");
}

function closeRejectModal() {
  rejectModal.classList.remove("show");
  rejectingRequestId = null;
}

document.getElementById("closeRejectModalBtn").addEventListener("click", closeRejectModal);
document.getElementById("cancelRejectBtn").addEventListener("click", closeRejectModal);
rejectModal.addEventListener("click", (e) => {
  if (e.target === rejectModal) closeRejectModal();
});

document.getElementById("confirmRejectBtn").addEventListener("click", async () => {
  if (!rejectingRequestId) return;
  const note = document.getElementById("rejectNote").value;

  try {
    const res = await fetch("/operator/stall-requests/" + rejectingRequestId + "/reject", {
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
