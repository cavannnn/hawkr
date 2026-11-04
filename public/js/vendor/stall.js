const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");


function authHeaders() {
  return { "Authorization": "Bearer " + token };
}

function showBanner(id, message) {
  const banner = document.getElementById(id);
  banner.textContent = message;
  banner.classList.add("show");
}

function hideBanners() {
  document.getElementById("errorBanner").classList.remove("show");
  document.getElementById("successBanner").classList.remove("show");
}


function statusPill(status) {
  return '<span class="pill ' + status + '">' + status + "</span>";
}


function gradePill(grade) {
  if (!grade) return "";
  return '<span class="pill grade-' + grade + '">Grade ' + grade + "</span>";
}


function renderStalls(stalls) {
  const grid = document.getElementById("stallGrid");

  if (stalls.length === 0) {
    grid.innerHTML = '<div class="empty-state">You don\'t have any stalls yet. Tap "Request New Stall" to get started.</div>';
    return;
  }

  grid.innerHTML = stalls.map(stall =>
    '<div class="card stall-card" onclick="window.location.href=\'storeDetail.html?stallId=' + stall.stallId + '\'">' +
      '<div class="stall-photo"><img src="' + stall.imageUrl + '" alt="' + stall.stallName + '" onerror="this.style.display=\'none\'"></div>' +
      '<div class="stall-info">' +
        '<div class="stall-name">' + stall.stallName + "</div>" +
        '<div class="stall-line">📍 ' + stall.centreName + "</div>" +
        '<div class="stall-line"># Unit: ' + stall.unitNumber + "</div>" +
        (stall.operatingHours ? '<div class="stall-line">🕒 ' + stall.operatingHours + "</div>" : "") +
        (stall.neaGrade ? '<div class="stall-line">' + gradePill(stall.neaGrade) + "</div>" : "") +
        (stall.pendingGrade ? '<div class="stall-line stall-pending">Declared Grade ' + stall.pendingGrade + " &mdash; confirmed at the next inspection</div>" : "") +
      "</div>" +
    "</div>"
  ).join("");
}


function renderRequests(requests) {
  const list = document.getElementById("requestList");

  if (requests.length === 0) {
    list.innerHTML = '<div class="empty-state">You have not sent any requests yet.</div>';
    return;
  }

  let rows = "";
  requests.forEach(req => {
    const date = new Date(req.requestedAt).toLocaleDateString();
    const note = req.reviewNote ? '<div class="review-note">Admin note: ' + req.reviewNote + "</div>" : "";
    const hours = req.operatingHours ? " · " + req.operatingHours : "";
    rows +=
      '<div class="request-row">' +
        (req.imageUrl ? '<div class="request-thumb"><img src="' + req.imageUrl + '" alt="" onerror="this.parentElement.style.display=\'none\'"></div>' : "") +
        "<div class=\"request-body\">" +
          '<div class="request-name">' + req.stallName + "</div>" +
          '<div class="request-sub">' + req.centreName + " · Unit " + req.unitNumber + hours + " · " + date + "</div>" +
          note +
        "</div>" +
        statusPill(req.status) +
      "</div>";
  });
  list.innerHTML = rows;
}


function renderCentres(centres) {
  const select = document.getElementById("centreId");
  centres.forEach(centre => {
    const option = document.createElement("option");
    option.value = centre.centreId;
    option.textContent = centre.centreName;
    select.appendChild(option);
  });
}


async function loadPage() {
  if (!token || !userId) {
    window.location.href = "/auth/login.html";
    return;
  }

  try {
    const [storeRes, centresRes] = await Promise.all([
      fetch("/vendor/" + userId + "/my-stalls", { headers: authHeaders() }),
      fetch("/vendor/" + userId + "/centres", { headers: authHeaders() })
    ]);

    if (storeRes.status === 401 || storeRes.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (!storeRes.ok || !centresRes.ok) throw new Error("Failed to load your stall data.");

    const store = await storeRes.json();
    const centres = await centresRes.json();

    renderStalls(store.stalls);
    renderRequests(store.requests);
    renderCentres(centres);
  } catch (err) {
    console.error("Error loading stall page:", err);
    showBanner("errorBanner", err.message || "Something went wrong.");
  }
}


const requestModal = document.getElementById("requestModal");

function openRequestModal() {
  requestModal.classList.add("show");
}

function closeRequestModal() {
  requestModal.classList.remove("show");
  document.getElementById("requestForm").reset();
  document.getElementById("imagePreviewWrap").hidden = true;
}

document.getElementById("openRequestBtn").addEventListener("click", openRequestModal);
document.getElementById("cancelRequestBtn").addEventListener("click", closeRequestModal);
requestModal.addEventListener("click", (e) => {
  if (e.target === requestModal) closeRequestModal();
});


document.getElementById("stallImage").addEventListener("change", () => {
  const file = document.getElementById("stallImage").files[0];
  const wrap = document.getElementById("imagePreviewWrap");
  const preview = document.getElementById("imagePreview");

  if (!file) {
    wrap.hidden = true;
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    wrap.hidden = false;
  };
  reader.readAsDataURL(file);
});


document.getElementById("requestForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanners();

  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;

  const formData = new FormData();
  formData.append("centreId", document.getElementById("centreId").value);
  formData.append("stallName", document.getElementById("stallName").value);
  formData.append("unitNumber", document.getElementById("unitNumber").value);
  formData.append("description", document.getElementById("description").value);
  formData.append("openingTime", document.getElementById("openingTime").value);
  formData.append("closingTime", document.getElementById("closingTime").value);
  formData.append("hygieneGrade", document.getElementById("hygieneGrade").value);

  const imageFile = document.getElementById("stallImage").files[0];
  if (imageFile) formData.append("stallImage", imageFile);

  try {
    const res = await fetch("/vendor/" + userId + "/stall-requests", {
      method: "POST",
      headers: authHeaders(),
      body: formData
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Could not send request.");

    showBanner("successBanner", data.message);
    closeRequestModal();
    loadPage();
  } catch (err) {
    showBanner("errorBanner", err.message);
  } finally {
    submitBtn.disabled = false;
  }
});


document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  window.location.href = "/auth/login.html";
});

loadPage();
