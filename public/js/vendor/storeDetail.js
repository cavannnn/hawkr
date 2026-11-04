const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");
const stallId = new URLSearchParams(window.location.search).get("stallId");

Chart.defaults.color = "#5b6472";
Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.borderColor = "#e7ebf1";

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

let topItemsChart = null;

function renderTopItemsChart(items) {
  const wrap = document.getElementById("topItemsChart").parentElement;

  if (!items || items.length === 0) {
    wrap.innerHTML = '<div class="empty-state">No sales yet. Best sellers will show here once this store gets orders.</div>';
    return;
  }

  if (topItemsChart) topItemsChart.destroy();
  topItemsChart = new Chart(document.getElementById("topItemsChart"), {
    type: "bar",
    data: {
      labels: items.map(i => i.itemName),
      datasets: [{
        label: "Quantity sold",
        data: items.map(i => i.totalQuantity),
        backgroundColor: "#d0433b",
        hoverBackgroundColor: "#b53030",
        borderRadius: 4,
        maxBarThickness: 24
      }]
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, grid: { display: false } },
        y: { grid: { display: false } }
      }
    }
  });
}

async function loadStore() {
  if (!token || !userId) {
    window.location.href = "/auth/login.html";
    return;
  }
  if (!stallId) {
    showBanner("errorBanner", "No store selected.");
    return;
  }

  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}`, { headers: authHeaders() });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (res.status === 404) {
      throw new Error("Store not found, or it doesn't belong to your account.");
    }
    if (!res.ok) throw new Error("Failed to load store details.");

    const data = await res.json();

    document.getElementById("pageTitle").textContent = data.stallName;
    const storeImage = document.getElementById("storeImage");
    if (data.imageUrl) {
      storeImage.src = data.imageUrl;
      storeImage.hidden = false;
    } else {
      storeImage.hidden = true;
    }
    storeImage.alt = data.stallName;
    document.getElementById("storeName").textContent = data.stallName;
    document.getElementById("storeLocation").textContent = data.centreName + " · Unit " + data.unitNumber;
    document.getElementById("storeOwner").textContent = data.ownerName || "—";
    document.getElementById("storeEmail").textContent = data.ownerEmail || "—";
    document.getElementById("storeHours").textContent = data.operatingHours || "—";
    document.getElementById("storeNeaGrade").textContent = data.neaGrade ? "Grade " + data.neaGrade : "-";
    const pendingEl = document.getElementById("storePendingGrade");
    if (pendingEl) {
      pendingEl.textContent = data.pendingGrade
        ? "Declared Grade " + data.pendingGrade + " — confirmed at the next inspection"
        : "";
      pendingEl.hidden = !data.pendingGrade;
    }

    document.getElementById("statOrders").textContent = Number(data.totalOrders || 0).toLocaleString();
    document.getElementById("statRevenue").textContent = money(data.totalRevenue);
    document.getElementById("statMonthSales").textContent = money(data.thisMonthSales);

    renderTopItemsChart(data.topItems);
    renderTarget(data.target);
    loadRentalStat();
  } catch (err) {
    console.error("Error loading store:", err);
    document.getElementById("storeName").textContent = "Error loading store";
    showBanner("errorBanner", err.message || "Something went wrong loading this store.");
  }
}

document.getElementById("updateMenuBtn").addEventListener("click", () => {
  window.location.href = `storeMenu.html?stallId=${stallId}`;
});

document.getElementById("trackInventoryBtn").addEventListener("click", () => {
  window.location.href = `storeStock.html?stallId=${stallId}`;
});

document.getElementById("customerFeedbackBtn").addEventListener("click", () => {
  window.location.href = `storeFeedback.html?stallId=${stallId}`;
});

document.getElementById("addPromotionBtn").addEventListener("click", () => {
  window.location.href = `storePromotions.html?stallId=${stallId}`;
});

document.getElementById("rentalAgreementBtn").addEventListener("click", () => {
  window.location.href = `storeRental.html?stallId=${stallId}`;
});


async function loadRentalStat() {
  const statEl = document.getElementById("statRental");
  try {
    const res = await fetch("/api/rental-agreements");
    if (!res.ok) throw new Error("Failed to load rental agreements.");
    const agreements = await res.json();

    const forThisStall = agreements
      .filter(a => String(a.StallId) === String(stallId))
      .sort((a, b) => new Date(b.AgreementEndDate) - new Date(a.AgreementEndDate));

    statEl.textContent = forThisStall[0] ? money(forThisStall[0].RentalPrice) + " / mo" : "No agreement";
  } catch (err) {
    console.error("Error loading rental stat:", err);
    statEl.textContent = "—";
    statEl.classList.add("is-error");
  }
}



const targetModal = document.getElementById("targetModal");

const TARGET_TYPE_LABELS = {
  revenue: "revenue",
  orders: "orders",
  items: "items sold",
  customers: "customers"
};

function targetStatusText(percent) {
  if (percent >= 100) return "Goal Achieved!";
  if (percent >= 80) return "Near Completion";
  if (percent >= 50) return "On Track";
  if (percent >= 25) return "In Progress";
  if (percent > 0) return "Just Started";
  return "Not Started";
}

function targetProgressLabel(target) {
  const label = TARGET_TYPE_LABELS[target.targetType] || target.targetType;
  const isMoney = target.targetType === "revenue";
  const prog = isMoney ? money(target.progressValue) : Number(target.progressValue).toLocaleString();
  const goal = isMoney ? money(target.targetValue) : Number(target.targetValue).toLocaleString();
  return prog + " of " + goal + " " + label + " goal this month";
}

function renderTarget(target) {
  const box = document.getElementById("targetContent");

  if (!target || !target.targetType) {
    box.innerHTML =
      '<div class="target-empty-icon">🎯</div>' +
      '<div class="empty-state">Set a monthly target to track progress here.</div>' +
      '<button type="button" class="btn target-btn" id="setTargetBtn">Set Target</button>';
    document.getElementById("setTargetBtn").addEventListener("click", () => openTargetModal(null));
    return;
  }

  box.innerHTML =
    '<div class="target-gauge-wrap">' +
      '<div class="target-gauge" style="--pct:' + target.progressPercent + '"></div>' +
      '<div class="target-gauge-inner"><div class="target-gauge-percent">' + target.progressPercent + '%</div></div>' +
    '</div>' +
    '<div class="target-status-pill">' + targetStatusText(target.progressPercent) + '</div>' +
    '<div class="target-progress-label">' + targetProgressLabel(target) + '</div>' +
    '<button type="button" class="btn target-btn" id="setTargetBtn">Edit Target</button>';
  document.getElementById("setTargetBtn").addEventListener("click", () => openTargetModal(target));
}

function openTargetModal(target) {
  hideBanners();
  document.getElementById("targetType").value = target && target.targetType ? target.targetType : "revenue";
  document.getElementById("targetValue").value = target && target.targetValue ? target.targetValue : "";
  targetModal.classList.add("show");
}

document.getElementById("cancelTargetBtn").addEventListener("click", () => targetModal.classList.remove("show"));
targetModal.addEventListener("click", (e) => {
  if (e.target === targetModal) targetModal.classList.remove("show");
});

document.getElementById("targetForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideBanners();

  const saveBtn = document.getElementById("saveTargetBtn");
  saveBtn.disabled = true;

  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}/target`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        targetType: document.getElementById("targetType").value,
        targetValue: document.getElementById("targetValue").value
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to save target.");

    targetModal.classList.remove("show");
    showBanner("successBanner", "Monthly target saved.");
    renderTarget(data.target);
  } catch (err) {
    showBanner("errorBanner", err.message);
  } finally {
    saveBtn.disabled = false;
  }
});



const deleteModal = document.getElementById("deleteModal");

document.getElementById("deleteStoreBtn").addEventListener("click", () => {
  hideBanners();
  deleteModal.classList.add("show");
});

document.getElementById("cancelDeleteBtn").addEventListener("click", () => {
  deleteModal.classList.remove("show");
});

deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) deleteModal.classList.remove("show");
});

document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
  const confirmBtn = document.getElementById("confirmDeleteBtn");
  confirmBtn.disabled = true;
  try {
    const res = await fetch(`/vendor/${userId}/stalls/${stallId}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to delete store.");

    window.location.href = "stall.html";
  } catch (err) {
    deleteModal.classList.remove("show");
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

loadStore();
