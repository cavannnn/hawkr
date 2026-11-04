const userId = localStorage.getItem("userId");
const token = localStorage.getItem("authToken");

const BLUE = "#913b9f";
const SPLIT_COLORS = ["#913b9f", "#008300", "#e87ba4", "#e6a339"];

const charts = {};


Chart.defaults.color = "#6b5e6f";
Chart.defaults.font.family = "'Google Sans Flex', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.borderColor = "#e9e4ea";

function showError(message) {
  const banner = document.getElementById("errorBanner");
  banner.textContent = message;
  banner.classList.add("show");
}

function setStat(id, value) {
  const el = document.getElementById(id);
  el.textContent = value;
  el.classList.remove("is-error");
}

function setStatError(id) {
  const el = document.getElementById(id);
  el.textContent = "—";
  el.classList.add("is-error");
}

function money(value) {
  return "$" + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderChart(canvasId, config) {
  if (charts[canvasId]) charts[canvasId].destroy();
  charts[canvasId] = new Chart(document.getElementById(canvasId), config);
}


function showEmpty(canvasId, message) {
  const wrap = document.getElementById(canvasId).parentElement;
  wrap.innerHTML = '<div class="empty-state">' + message + "</div>";
}

function renderSalesTrend(trend) {
  if (trend.length === 0) {
    showEmpty("salesTrend", "No sales yet. Your monthly sales will show here once you get orders.");
    return;
  }

  renderChart("salesTrend", {
    type: "bar",
    data: {
      labels: trend.map(row => row.label),
      datasets: [{
        label: "Sales",
        data: trend.map(row => row.value),
        backgroundColor: BLUE,
        hoverBackgroundColor: "#6f2d7a",
        borderRadius: 4,
        maxBarThickness: 40
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true }
      }
    }
  });
}

function renderRevenueSplit(split) {
  if (split.length === 0) {
    showEmpty("revenueSplit", "No revenue yet.");
    return;
  }

  renderChart("revenueSplit", {
    type: "doughnut",
    data: {
      labels: split.map(row => row.label),
      datasets: [{
        data: split.map(row => row.value),
        backgroundColor: SPLIT_COLORS,
        borderColor: "#ffffff",
        borderWidth: 2,
        hoverOffset: 12
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "55%",
      animation: { animateScale: true },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, usePointStyle: true } }
      }
    }
  });
}

let currentMonthlyGoal = 0;

function renderOrderSummary(revenue, goal) {
  currentMonthlyGoal = Number(goal) || 0;
  const box = document.getElementById("orderSummary");
  const percent = currentMonthlyGoal > 0 ? Math.min(100, Math.round((Number(revenue) / currentMonthlyGoal) * 100)) : 0;

  box.innerHTML =
    '<div class="order-summary-gauge-wrap">' +
      '<div class="order-summary-gauge" style="--pct:' + percent + '"></div>' +
      '<div class="order-summary-gauge-inner"><div class="order-summary-percent">' + percent + '%</div></div>' +
    '</div>' +
    '<div class="order-summary-goal-label">' + money(revenue) + ' / ' + money(currentMonthlyGoal) + ' Goal</div>';
}

function renderTopItems(items) {
  if (!items || items.length === 0) {
    showEmpty("topItems", "No sales yet. Best sellers will show here once you get orders.");
    return;
  }

  renderChart("topItems", {
    type: "bar",
    data: {
      labels: items.map(i => i.itemName),
      datasets: [{
        label: "Quantity sold",
        data: items.map(i => i.quantity),
        backgroundColor: BLUE,
        hoverBackgroundColor: "#6f2d7a",
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

function renderFulfillment(fulfillment) {
  const box = document.getElementById("fulfillment");
  const pill = document.getElementById("fulfillmentRatePill");
  const successful = fulfillment.successful || 0;
  const unsuccessful = fulfillment.unsuccessful || 0;
  const inProgress = fulfillment.inProgress || 0;
  const resolved = successful + unsuccessful;
  const total = resolved + inProgress;

  pill.textContent = resolved > 0 ? fulfillment.successRate + "% Success" : "No data yet";

  if (total === 0) {
    box.innerHTML = '<div class="empty-state">No orders yet.</div>';
    return;
  }

  
  const pctOf = count => Math.round((count / total) * 100);

  box.innerHTML =
    '<div class="fulfillment-row">' +
      '<div class="fulfillment-row-label"><span>Successful</span><span>' + successful.toLocaleString() + '</span></div>' +
      '<div class="fulfillment-bar-track"><div class="fulfillment-bar-fill" style="width:' + pctOf(successful) + '%"></div></div>' +
    '</div>' +
    '<div class="fulfillment-row">' +
      '<div class="fulfillment-row-label"><span>Unsuccessful</span><span>' + unsuccessful.toLocaleString() + '</span></div>' +
      '<div class="fulfillment-bar-track"><div class="fulfillment-bar-fill unsuccessful" style="width:' + pctOf(unsuccessful) + '%"></div></div>' +
    '</div>' +
    '<div class="fulfillment-row">' +
      '<div class="fulfillment-row-label"><span>In Progress</span><span>' + inProgress.toLocaleString() + '</span></div>' +
      '<div class="fulfillment-bar-track"><div class="fulfillment-bar-fill in-progress" style="width:' + pctOf(inProgress) + '%"></div></div>' +
    '</div>';
}

function renderRecentOrders(orders) {
  const box = document.getElementById("recentOrders");

  if (orders.length === 0) {
    box.innerHTML = '<div class="empty-state">No orders yet.</div>';
    return;
  }

  let rows = "";
  orders.forEach(order => {
    const date = new Date(order.orderDate).toLocaleDateString();
    rows += "<tr>" +
      "<td>#" + order.orderId + "</td>" +
      "<td>" + date + "</td>" +
      '<td><span class="pill">' + order.status + "</span></td>" +
      '<td class="amount">' + money(order.totalAmount) + "</td>" +
      "</tr>";
  });

  box.innerHTML =
    '<table class="data-table">' +
    "<thead><tr><th>Order</th><th>Date</th><th>Status</th><th>Amount</th></tr></thead>" +
    "<tbody>" + rows + "</tbody></table>";
}

async function loadDashboard() {
  if (!token || !userId) {
    window.location.href = "/auth/login.html";
    return;
  }

  try {
    const res = await fetch(`/vendor/${userId}/dashboard`, {
      headers: { "Authorization": `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (!res.ok) throw new Error("Failed to load dashboard data.");

    const data = await res.json();

    setStat("revenue", money(data.TotalRevenue));
    setStat("menus", Number(data.TotalMenus || 0).toLocaleString());
    setStat("orders", Number(data.TotalOrders || 0).toLocaleString());
    setStat("customers", Number(data.TotalCustomers || 0).toLocaleString());

    renderSalesTrend(data.MonthlySalesTrend || []);
    renderRevenueSplit(data.RevenueSplit || []);
    renderOrderSummary(data.TotalRevenue, data.MonthlyGoal);
    renderTopItems(data.TopSellingItems || []);
    renderFulfillment(data.Fulfillment || { successful: 0, unsuccessful: 0, inProgress: 0, successRate: 0 });
    renderRecentOrders(data.RecentOrders || []);
  } catch (err) {
    console.error("Error loading dashboard:", err);
    showError(err.message || "Something went wrong loading your dashboard.");
    setStatError("revenue");
    setStatError("menus");
    setStatError("orders");
    setStatError("customers");
  }
}



const goalModal = document.getElementById("goalModal");

document.getElementById("editGoalBtn").addEventListener("click", () => {
  document.getElementById("goalValue").value = currentMonthlyGoal || "";
  goalModal.classList.add("show");
});

document.getElementById("cancelGoalBtn").addEventListener("click", () => goalModal.classList.remove("show"));
goalModal.addEventListener("click", (e) => {
  if (e.target === goalModal) goalModal.classList.remove("show");
});

document.getElementById("goalForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const saveBtn = document.getElementById("saveGoalBtn");
  saveBtn.disabled = true;

  try {
    const res = await fetch(`/vendor/${userId}/dashboard/goal`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ monthlyGoal: document.getElementById("goalValue").value })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to save goal.");

    goalModal.classList.remove("show");
    await loadDashboard();
  } catch (err) {
    showError(err.message);
  } finally {
    saveBtn.disabled = false;
  }
});


document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  window.location.href = "/auth/login.html";
});

loadDashboard();
