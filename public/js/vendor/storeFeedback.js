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

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

function renderStars(rating) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function renderSummary(summary) {
  const box = document.getElementById("reviewsSummary");

  if (!summary.average_rating) {
    box.innerHTML = '<div class="empty-state">No customer reviews yet.</div>';
    return;
  }

  box.innerHTML =
    '<span class="avg-rating">' + summary.average_rating.toFixed(1) + '</span>' +
    '<span class="avg-stars">' + renderStars(Math.round(summary.average_rating)) + '</span>' +
    '<span class="review-count">' + summary.review_count + ' review' + (summary.review_count === 1 ? "" : "s") + '</span>';
}

function renderReviews(reviews) {
  const list = document.getElementById("reviewsList");
  const emptyMsg = document.getElementById("reviewsEmptyMsg");

  if (!reviews || reviews.length === 0) {
    list.innerHTML = "";
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  list.innerHTML = reviews.map(r =>
    '<div class="review-item">' +
      '<div class="review-item-header">' +
        '<span class="review-item-stars">' + renderStars(r.rating) + '</span>' +
        '<span class="review-item-author">' + escapeHtml(r.customer_name || "Anonymous") + '</span>' +
        '<span class="review-item-date">' + (r.created_at ? new Date(r.created_at).toLocaleDateString() : "") + '</span>' +
      '</div>' +
      (r.comment ? '<div class="review-item-comment">' + escapeHtml(r.comment) + '</div>' : '') +
    '</div>'
  ).join("");
}

async function loadFeedback() {
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
    document.getElementById("storeNameTitle").textContent = "Customer Feedback — " + stall.stallName;

    
    
    const reviewsRes = await fetch(`/vendor/${userId}/stalls/${stallId}/reviews`, { headers: authHeaders() });
    if (!reviewsRes.ok) throw new Error("Failed to load reviews.");
    const reviewsData = await reviewsRes.json();

    renderSummary(reviewsData.summary);
    renderReviews(reviewsData.reviews);
  } catch (err) {
    console.error("Error loading feedback:", err);
    document.getElementById("reviewsSummary").innerHTML = "";
    showBanner("errorBanner", err.message || "Something went wrong loading this store's feedback.");
  }
}




document.getElementById("logoutBtn").addEventListener("click", () => {
  localStorage.removeItem("authToken");
  localStorage.removeItem("userRole");
  localStorage.removeItem("userId");
  window.location.href = "/auth/login.html";
});

loadFeedback();
