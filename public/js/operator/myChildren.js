const token = localStorage.getItem("authToken");
const role = localStorage.getItem("userRole");

function authHeaders() {
  return { "Authorization": "Bearer " + token };
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text == null ? "" : text;
  return div.innerHTML;
}

function money(value) {
  return "$" + Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function gradeClass(grade) {
  return grade ? "grade-" + grade : "grade-unknown";
}

const CUISINE_IMAGES = {
  western: "../../images/western.png",
  chinese: "../../images/chinese.png",
  korean: "../../images/korean.png",
  sushi: "../../images/sushi.png",
  japanese: "../../images/Japanese.png",
  malay: "../../images/malay.png",
  indian: "../../images/Indian.png",
  thai: "../../images/Thai.png",
  halal: "../../images/halal.png",
  desserts: "../../uploads/stalls/category-desserts.jpg",
  drinks: "../../uploads/stalls/category-drinks.jpg",
};

function stallImage(stall) {
  if (stall.imageUrl) return escapeHtml(stall.imageUrl);
  return CUISINE_IMAGES[String(stall.cuisineType || "").trim().toLowerCase()] || null;
}

function childCardHtml(stall, index) {
  const grade = stall.neaGrade;
  const gradeBadge = grade
    ? '<span class="childCard__grade ' + gradeClass(grade) + '">Grade ' + escapeHtml(grade) + "</span>"
    : "";
  const pendingNote = stall.pendingGrade
    ? '<span class="childCard__pending">Declared Grade ' + escapeHtml(stall.pendingGrade) + " — confirmed at the next inspection</span>"
    : "";
  const src = stallImage(stall);
  const fallback = CUISINE_IMAGES[String(stall.cuisineType || "").trim().toLowerCase()] || "";
  const onError = fallback && fallback !== src
    ? ' onerror="this.onerror=null;this.src=\'' + fallback + '\'"'
    : ' onerror="this.onerror=null;this.classList.add(\'childCard__thumb--placeholder\');this.removeAttribute(\'src\')"';
  const thumb = src
    ? '<img class="childCard__thumb" src="' + src + '" alt=""' + onError + ">"
    : '<div class="childCard__thumb childCard__thumb--placeholder" aria-hidden="true"></div>';

  return (
    '<button type="button" class="childCard" data-stall-id="' + stall.stallId + '" style="--stagger: ' + index + '">' +
      thumb +
      '<div class="childCard__body">' +
        '<div class="childCard__head">' +
          '<span class="childCard__name">' + escapeHtml(stall.stallName) + "</span>" +
          gradeBadge +
        "</div>" +
        '<div class="childCard__meta">' + escapeHtml(stall.centreName) + " · Unit " + escapeHtml(stall.unitNumber) + "</div>" +
        '<div class="childCard__vendor">👤 ' + escapeHtml(stall.vendorName) + "</div>" +
        pendingNote +
      "</div>" +
    "</button>"
  );
}

function renderChildren(stalls) {
  const grid = document.getElementById("childrenGrid");

  if (stalls.length === 0) {
    grid.innerHTML =
      '<div class="emptyState">' +
        '<img class="emptyStateImage" src="../../images/noChildren.svg" alt="">' +
        '<p class="emptyStateTitle">No stalls yet</p>' +
        '<p class="emptyStateBody">Approve a stall request and it will show up here.</p>' +
      "</div>";
    return;
  }

  grid.innerHTML = stalls.map(childCardHtml).join("");

  grid.querySelectorAll("[data-stall-id]").forEach((card) => {
    card.addEventListener("click", () => openChildModal(card.dataset.stallId));
  });
}

async function loadChildren() {
  const grid = document.getElementById("childrenGrid");

  if (!token || role !== "operator") {
    grid.innerHTML = '<div class="emptyState"><p class="emptyStateTitle">You must be logged in as an operator to view this page.</p></div>';
    return;
  }

  try {
    const res = await fetch("/operator/stalls", { headers: authHeaders() });
    if (res.status === 401 || res.status === 403) {
      throw new Error("Your session is invalid or expired. Please log in again.");
    }
    if (!res.ok) throw new Error("Failed to load your stalls.");

    const stalls = await res.json();
    renderChildren(stalls);
  } catch (err) {
    console.error("Error loading children:", err);
    grid.innerHTML = '<div class="emptyState"><p class="emptyStateTitle">Could not load your stalls</p><p class="emptyStateBody">' + escapeHtml(err.message) + "</p></div>";
  }
}



const childModal = document.getElementById("childModal");
const childModalBody = document.getElementById("childModalBody");

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function statBlockHtml(stats) {
  return (
    '<div class="childStatGrid">' +
      '<div class="childStat"><span class="childStat__value">' + (stats.totalOrders || 0) + '</span><span class="childStat__label">Total orders</span></div>' +
      '<div class="childStat"><span class="childStat__value">' + money(stats.totalRevenue) + '</span><span class="childStat__label">Lifetime revenue</span></div>' +
      '<div class="childStat"><span class="childStat__value">' + money(stats.thisMonthSales) + '</span><span class="childStat__label">This month</span></div>' +
    "</div>"
  );
}

function topItemsHtml(topItems) {
  if (!topItems || topItems.length === 0) {
    return '<p class="childDetail__empty">No orders yet, so no top sellers to show.</p>';
  }
  return (
    '<ul class="childTopItems">' +
      topItems.map((item) =>
        "<li><span>" + escapeHtml(item.itemName) + "</span><span>" + item.totalQuantity + " sold</span></li>"
      ).join("") +
    "</ul>"
  );
}

function childDetailHtml(data) {
  const grade = data.neaGrade;
  const agreement = data.agreement;
  const heroSrc = stallImage(data);
  const heroFallback = CUISINE_IMAGES[String(data.cuisineType || "").trim().toLowerCase()] || "";
  const heroError = heroFallback && heroFallback !== heroSrc
    ? ' onerror="this.onerror=null;this.src=\'' + heroFallback + '\'"'
    : ' onerror="this.onerror=null;this.style.display=\'none\'"';

  return (
    '<div class="childDetail">' +
      (heroSrc ? '<img class="childDetail__hero" src="' + heroSrc + '" alt=""' + heroError + ">" : "") +
      '<h3 class="childDetail__title">' + escapeHtml(data.stallName) + "</h3>" +
      '<p class="childDetail__sub">' + escapeHtml(data.centreName) + " · Unit " + escapeHtml(data.unitNumber) + "</p>" +

      '<div class="childDetail__row"><span>Vendor</span><span>' + escapeHtml(data.vendorName) + (data.vendorEmail ? " · " + escapeHtml(data.vendorEmail) : "") + "</span></div>" +
      '<div class="childDetail__row"><span>Operating hours</span><span>' + escapeHtml(data.operatingHours || "—") + "</span></div>" +
      '<div class="childDetail__row"><span>NEA grade</span><span>' + (grade ? "Grade " + escapeHtml(grade) : "Not graded yet") + "</span></div>" +
      (data.pendingGrade ? '<div class="childDetail__row"><span></span><span class="childCard__pending">Declared Grade ' + escapeHtml(data.pendingGrade) + " — confirmed at the next inspection</span></div>" : "") +
      '<div class="childDetail__row"><span>Address</span><span>' + escapeHtml(data.address || "—") + "</span></div>" +

      (agreement ? (
        '<div class="childDetail__row"><span>Rental agreement</span><span>' + money(agreement.RentalPrice) + " / month · " + formatDate(agreement.AgreementStartDate) + " – " + formatDate(agreement.AgreementEndDate) + "</span></div>"
      ) : "") +

      "<h4 class=\"childDetail__heading\">Order performance</h4>" +
      statBlockHtml(data.stats || {}) +

      "<h4 class=\"childDetail__heading\">Top sellers</h4>" +
      topItemsHtml(data.topItems) +
    "</div>"
  );
}

async function openChildModal(stallId) {
  childModalBody.innerHTML = '<div class="childDetail__loading">Loading…</div>';
  childModal.classList.add("show");

  try {
    const res = await fetch("/operator/stalls/" + stallId, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Could not load this stall.");
    childModalBody.innerHTML = childDetailHtml(data);
  } catch (err) {
    childModalBody.innerHTML = '<p class="childDetail__empty">' + escapeHtml(err.message) + "</p>";
  }
}

function closeChildModal() {
  childModal.classList.remove("show");
}

document.getElementById("childModalClose").addEventListener("click", closeChildModal);
childModal.addEventListener("click", (e) => {
  if (e.target === childModal) closeChildModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && childModal.classList.contains("show")) closeChildModal();
});

loadChildren();
