const SEARCH_PLACEHOLDERS = [
  "Search for food",
  "Search for whatever fancies you…",
  "Search for anything…",
  "Hungry… hungry?",
];

const CUISINES = [
  { name: "Western", img: "western.png", bg: "#E8B04B" },
  { name: "Chinese", img: "chinese.png", bg: "#E86A5C" },
  { name: "Korean", img: "korean.png", bg: "#f9dd3f" }, // real Figma selected-card hex (93:1776)
  { name: "Sushi", img: "sushi.png", bg: "#ef636a" }, // real Figma selected-card hex (93:1776)
  { name: "Malay", img: "malay.png", bg: "#6FCF97", round: true },
  { name: "Halal", img: "halal.png", bg: "#56A46B", dietary: true },
];
const DIETARY = new Set(CUISINES.filter((c) => c.dietary).map((c) => c.name));

const DISHES = {
  "Northern Thai": [
    { name: "Green Curry", price: "$6.50", img: "/images/northern-thai.png" },
    { name: "Pad Thai", price: "$5.00", img: "/images/beef-goulash.png" },
    { name: "Tom Yum Soup", price: "$7.00", img: "/images/redhill-prawn-noodle.png" },
  ],
  "Redhill Prawn Noodle": [
    { name: "Prawn Noodle", price: "$5.50", img: "/images/redhill-prawn-noodle.png" },
    { name: "Laksa", price: "$6.00", img: "/images/beef-goulash.png" },
  ],
  "Seoul Kitchen": [
    { name: "Bibimbap", price: "$8.00", img: "/images/beef-goulash.png" },
    { name: "Kimchi Stew", price: "$7.50", img: "/images/northern-thai.png" },
  ],
};
function dishesOf(store) {
  const live = window.hawkrCatalog && window.hawkrCatalog.dishesFor(store);
  if (live) return live;
  return DISHES[store.name] || [];
}
function dishNames() {
  return STORES.flatMap((s) => dishesOf(s).map((d) => d.name.toLowerCase()));
}

const tiltFor = (name) =>
  ([...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 9) - 4; // −4°…+4°

const selectedCuisines = new Set();

const FALLBACK_STORES = [
  {
    name: "Northern Thai", img: "/images/northern-thai.png", stallId: 1, // → backend Stall 1 (has feedback)
    location: "Maxwell Food Centre", distance: "1.5km", coords: { lat: 1.2803, lng: 103.8451 },
    open: false, statusNote: "Opens 5:00pm",
    tags: ["Halal", "Chinese", "Malay", "Thai", "Indian"],
    grade: "A", gradedAt: "2026-03-14", rating: "4.5", reviews: "2 reviews",
  },
  {
    name: "Redhill Prawn Noodle", img: "/images/redhill-prawn-noodle.png", stallId: 2, // → backend Stall 2 (has feedback)
    location: "Redhill Market & Food Centre", distance: "5.3km", coords: { lat: 1.2896, lng: 103.8172 },
    open: true, statusNote: "Closes 11:00pm",
    tags: ["Halal", "Chinese", "Malay"],
    // SAFE-era grade
    grade: "B", gradedAt: "2026-02-08", rating: "4.5", reviews: "2 reviews",
  },
  {
    name: "Seoul Kitchen", img: "/images/beef-goulash.png", stallId: 7, // → backend Stall 7 (has feedback)
    location: "Chinatown Complex", distance: "2.1km", coords: { lat: 1.2826, lng: 103.8436 },
    open: true, statusNote: "Closes 9:30pm",
    tags: ["Korean", "Halal"],
    grade: "A", gradedAt: "2025-06-02", rating: "4.6", reviews: "48 reviews",
  },
  {
    name: "Sushi Go", img: "/images/northern-thai.png", stallId: 13, // → backend Stall 13 (has feedback)
    location: "Amoy Street Food Centre", distance: "3.0km", coords: { lat: 1.2795, lng: 103.8465 },
    open: false, statusNote: "Opens 11:30am",
    tags: ["Sushi"],
    grade: "A", gradedAt: "2024-11-21", rating: "4.4", reviews: "12 reviews",
  },
  {
    name: "Western Grill", img: "/images/redhill-prawn-noodle.png",
    location: "Old Airport Road", distance: "4.2km", coords: { lat: 1.3080, lng: 103.8855 },
    open: true, statusNote: "Closes 10:00pm",
    tags: ["Western", "Halal"],
    grade: "B", gradedAt: "2024-03-06", rating: "4.2", reviews: "30 reviews",
  },
];

const STORES = [];

const FALLBACK_CENTRES = {
  "Maxwell Food Centre": { name: "Maxwell Food Centre", addr: "1 Kadayanallur St, Singapore 069184", hawkerCentre: true, hawkerId: 1 },
  "Redhill Market & Food Centre": { name: "Redhill Market & Food Centre", hawkerCentre: true, hawkerId: null },
  "Chinatown Complex": { name: "Chinatown Complex", hawkerCentre: true, hawkerId: 2 },
  "Amoy Street Food Centre": { name: "Amoy Street Food Centre", hawkerCentre: true, hawkerId: 3 },
  "Old Airport Road": { name: "Old Airport Road", hawkerCentre: true, hawkerId: null },
};

const CENTRES = {};

/* ---------------- the live catalog, applied ---------------- */
function applyCatalog() {
  const C = window.hawkrCatalog;
  const live = C && C.isLive();
  const stores = live ? C.stores() : FALLBACK_STORES;
  const centres = live ? C.centres() : FALLBACK_CENTRES;

  STORES.length = 0;
  stores.forEach((s) => STORES.push(s));
  Object.keys(CENTRES).forEach((k) => delete CENTRES[k]);
  Object.keys(centres).forEach((k) => (CENTRES[k] = centres[k]));
}

function catalogNotice() {
  const state = window.hawkrCatalog ? window.hawkrCatalog.state() : "failed";
  const block = (title, text) =>
    `<div class="rail-empty"><p class="rail-empty__title">${title}</p><p class="rail-empty__text">${text}</p></div>`;
  if (state === "loading") return block("Finding stalls…", "Reading the menu from the kitchen.");
  if (state === "failed") {
    return block("We couldn't reach the stalls",
      "These are sample stalls, not real ones — you can look, but an order won't get through. Check your connection and reload.");
  }
  if (state === "empty") return block("No stalls listed yet", "Nothing has been added to a hawker centre on this server.");
  return "";
}

const SAFE_FROM = "2026-01-19";
const isSafeGrade = (store) => store.gradedAt >= SAFE_FROM;
const gradeMonth = (store) =>
  new Date(store.gradedAt).toLocaleDateString("en-SG", { month: "short", year: "numeric" });
const gradeFullDate = (store) =>
  new Date(store.gradedAt).toLocaleDateString("en-SG", { day: "numeric", month: "long", year: "numeric" });

function dot() {
  return `<span class="dot"></span>`;
}

function imgFallbackAttr(obj) {
  const fb = obj && obj.imgFallback;
  if (!fb) return "";
  return ` onerror="this.onerror=null;this.src='${fb.replace(/'/g, "\\'")}'"`;
}
window.hawkrImgFallbackAttr = imgFallbackAttr;

function cuisineTemplate({ name, img, bg, round }) {
  const roundCls = round ? " cuisine-photo--round" : "";
  const on = selectedCuisines.has(name);
  return `
    <button class="cuisine-item${on ? " is-selected" : ""}" type="button"
            data-name="${name}" aria-pressed="${on}"
            style="--chip-bg:${bg};--tilt:${tiltFor(name)}deg">
      <span class="cuisine-photo-wrap">
        <img class="cuisine-photo${roundCls}" src="../images/${img}" alt="${name}">
        <span class="cuisine-check" aria-hidden="true"></span>
      </span>
      <span class="cuisine-label">${name}</span>
    </button>`;
}

function neaGradeTagTemplate(store) {
  if (store.pendingGrade) {
    return `<span class="tag tag--grade tag--grade-pending" title="Declared by the stall, confirmed at its next inspection">Grade ${store.pendingGrade} pending</span>`;
  }
  if (!store.neaGrade || store.neaGrade === "NEW") {
    return `<span class="tag tag--grade tag--grade-new" title="Not yet inspected">Ungraded</span>`;
  }
  return `<span class="tag tag--grade tag--grade-${store.neaGrade}" title="NEA hygiene inspection grade">Grade ${store.neaGrade}</span>`;
}

function tagTemplate(tag) {
  const isHalal = tag === "Halal";
  const cls = isHalal ? "tag tag--halal" : "tag";
  const icon = isHalal ? `<img class="tag__icon" src="../images/halal-mark.png" alt="">` : "";
  return `<span class="${cls}">${icon}${tag}</span>`;
}

function centreStripTemplate(store) {
  const C = window.hawkrCentre;
  if (!C) return ""; // shim not loaded — say nothing rather than guess
  const closure = C.closureLine(store);
  if (closure) {
    return `<p class="centre-strip centre-strip--${closure.state}">
        <span class="centre-strip__dot" aria-hidden="true"></span>${closure.short}
      </p>`;
  }
  const promo = C.promotionLine(store);
  if (promo) {
    return `<p class="centre-strip centre-strip--promo">
        <span class="centre-strip__dot" aria-hidden="true"></span>${promo.short}
      </p>`;
  }
  const stallPromo = C.vendorPromotionLine(store);
  if (stallPromo) {
    return `<p class="centre-strip centre-strip--promo">
        <span class="centre-strip__dot" aria-hidden="true"></span>${stallPromo.short}
      </p>`;
  }
  return "";
}

function storeCardTemplate(store) {
  const tags = (store.tags || []).map(tagTemplate).join("") + neaGradeTagTemplate(store);
  const centreStrip = centreStripTemplate(store);

  const photo = store.img
    ? `<img class="store-card__photo" src="${store.img}" alt="${store.name}"${imgFallbackAttr(store)}>` : "";

  const where = store.location + (store.distance ? dot() + store.distance : "");

  let status = "";
  if (store.open != null) {
    const statusColor = store.open ? "var(--status-open)" : "var(--status-closed)";
    const statusLabel = store.open ? "Open" : "Closed";
    status = `<span style="color:${statusColor}">${statusLabel}</span>` +
      (store.statusNote ? dot() + store.statusNote : "");
  } else if (store.statusNote) {
    status = store.statusNote;
  }
  const statusLine = status
    ? `<p class="store-card__meta"><img class="meta-icon" src="../images/clock.svg" alt="">${status}</p>` : "";

  const grade = store.grade
    ? `<span class="grade-chip">
          <span class="grade-chip__letter">${store.grade}</span>
          <img class="grade-chip__line" src="../images/grade-divider.svg" alt="">
          <span class="grade-chip__text">Clean since ${gradeMonth(store)}</span>
        </span>` : "";
  const rating = store.rating
    ? `<span class="rating">
          ${store.rating}<img class="rating__star" src="../images/star.svg" alt="">(${store.reviews})
        </span>` : "";
  const footer = grade || rating ? `<div class="store-card__footer">${grade}${rating}</div>` : "";

  return `
    <a class="store-card" href="#" data-store="${store.name}">
      ${centreStrip}
      <div class="store-card__top">
        ${photo}
        <div class="store-card__info">
          <div class="store-card__head">
            <h3 class="store-card__name">${store.name}</h3>
            <div class="meta-lines">
              <p class="store-card__meta">${where}</p>
              ${statusLine}
            </div>
          </div>
          <div class="store-card__tags">${tags}</div>
        </div>
      </div>
      ${footer}
    </a>`;
}

function render(list, containerSelector, templateFn) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.innerHTML = list.map(templateFn).join("");
}

/* ---------------- Cuisine filter selection ---------------- */
function toggleCuisine(name) {
  if (selectedCuisines.has(name)) selectedCuisines.delete(name);
  else selectedCuisines.add(name); // append = selection order

  const on = selectedCuisines.has(name);
  document.querySelectorAll(`.cuisine-item[data-name="${CSS.escape(name)}"]`).forEach((btn) => {
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", String(on));
  });
  writeInputFromChips();
}

// ---------------- Search bar (typeable; two-way synced with the chips) ----------------
const VOCAB = new Map(CUISINES.map((c) => [c.name.toLowerCase(), c.name]));
let phTimer = null;
let phIndex = 0;

const searchInput = () => document.querySelector(".search-bar__input");
const tokensOf = (v) => v.split(",").map((s) => s.trim()).filter(Boolean);

function writeInputFromChips() {
  const inputs = document.querySelectorAll(".search-bar__input");
  if (!inputs.length) return;
  const free = tokensOf(inputs[0].value).filter((t) => !VOCAB.get(t.toLowerCase()));
  const val = [...selectedCuisines, ...free].join(", ");
  inputs.forEach((i) => (i.value = val));
  updateSearchState();
}

function syncChipsFromInput(e) {
  const input = e.target;
  selectedCuisines.clear();
  tokensOf(input.value).forEach((t) => {
    const c = VOCAB.get(t.toLowerCase());
    if (c) selectedCuisines.add(c); // order in the string = selection order
  });
  document.querySelectorAll(".search-bar__input").forEach((i) => {
    if (i !== input) i.value = input.value; // keep both fields in lockstep
  });
  document.querySelectorAll(".cuisine-item").forEach((btn) => {
    const on = selectedCuisines.has(btn.dataset.name);
    btn.classList.toggle("is-selected", on);
    btn.setAttribute("aria-pressed", String(on));
  });
  updateSearchState();
}

// magnifier ↔ × swap on every bar + placeholder rotation + re-render both feeds
function updateSearchState() {
  const inputs = document.querySelectorAll(".search-bar__input");
  const populated = inputs.length > 0 && inputs[0].value.trim().length > 0;
  document.querySelectorAll(".search-bar").forEach((bar) => bar.classList.toggle("is-populated", populated));
  if (populated) stopRotation();
  else startRotation();
  renderResultsFeed(); // results-view feed only — the home FYP stays static
}

function openSearchPage() {
  const focusField = () => {
    const ri = document.querySelector("#view-results .search-bar__input");
    if (ri) ri.focus({ preventScroll: true });
  };
  if (typeof currentView === "function" && currentView() === "results") { focusField(); return; }
  if (typeof closeSuggest === "function") closeSuggest();
  history.pushState({ view: "results" }, "", "#results");
  if (document.startViewTransition) {
    const t = document.startViewTransition(() => { applyView("results"); focusField(); });
    t.finished.then(focusField).catch(() => {});
  } else {
    applyView("results");
    focusField();
  }
}

function clearSearch() {
  document.querySelectorAll(".search-bar__input").forEach((i) => (i.value = ""));
  selectedCuisines.clear();
  document.querySelectorAll(".cuisine-item.is-selected").forEach((btn) => {
    btn.classList.remove("is-selected");
    btn.setAttribute("aria-pressed", "false");
  });
  updateSearchState();
}

// Rotating placeholder while the input is empty + unfocused.
function phAdvance() {
  const input = searchInput();
  if (!input || input.value || document.activeElement === input) return;
  phIndex = (phIndex + 1) % SEARCH_PLACEHOLDERS.length;
  const next = SEARCH_PLACEHOLDERS[phIndex];
  input.classList.add("is-ph-swapping"); // fade the old word out
  setTimeout(() => {
    input.placeholder = next; // swap while invisible…
    input.classList.remove("is-ph-swapping"); // …then fade the new word in
  }, 240); // = the CSS opacity duration
}
function startRotation() {
  const input = searchInput();
  if (input && !input.value) input.placeholder = SEARCH_PLACEHOLDERS[phIndex];
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!phTimer) phTimer = setInterval(phAdvance, 4500);
}
function stopRotation() {
  clearInterval(phTimer);
  phTimer = null;
}

// ---------------- Results feed (swaps "You might like…" for filtered results) ----------------
function freeTextQuery() {
  const input = searchInput();
  if (!input) return "";
  return tokensOf(input.value).filter((t) => !VOCAB.get(t.toLowerCase())).join(" ").trim();
}
function getResults() {
  const q = freeTextQuery().toLowerCase();
  const sel = [...selectedCuisines];
  const cuisines = sel.filter((c) => !DIETARY.has(c));
  const dietary = sel.filter((c) => DIETARY.has(c));
  return STORES.filter((s) => {
    const cuisineOk = !cuisines.length || cuisines.some((c) => s.tags.includes(c));
    // SEAM: when wired to the DB, dietary matches a stall flag (s.isHalal), not a tag.
    const dietaryOk = dietary.every((d) => s.tags.includes(d)); // [].every() = true → no effect unless a dietary chip is picked
    const hay = `${s.name} ${s.tags.join(" ")} ${dishesOf(s).map((d) => d.name).join(" ")}`.toLowerCase();
    return cuisineOk && dietaryOk && (!q || hay.includes(q));
  });
}
function renderFyp() {
  const title = document.querySelector(".rail__title");
  if (title) title.textContent = "You might like…";
  const row = document.querySelector(".you-might-like-row");
  if (!row) return;
  row.innerHTML = catalogNotice() + STORES.map(storeCardTemplate).join("");
}

/* ---------------- Results view feed (stall cards + Grab-style dish rows) ---------------- */
function dishCardTemplate(d) {
  const photo = d.img ? `<img class="dish-card__photo" src="${d.img}" alt=""${imgFallbackAttr(d)}>` : "";
  return `
    <div class="dish-card">
      ${photo}
      <p class="dish-card__name">${d.name}</p>
      <p class="dish-card__price">${d.was ? `<s class="dish-card__was">${d.was}</s> ` : ""}${d.price}</p>
    </div>`;
}
function renderResultsFeed() {
  const feed = document.querySelector(".results-feed");
  if (!feed) return;
  const notice = catalogNotice();
  const results = getResults();
  if (!results.length) {
    feed.innerHTML = notice || `
      <div class="rail-empty">
        <p class="rail-empty__title">No spots match</p>
        <p class="rail-empty__text">Try a different cuisine, or clear to see everything.</p>
      </div>`;
    return;
  }
  const q = freeTextQuery().toLowerCase();
  const names = dishNames();
  const dishQuery = q.length > 0 && names.some((n) => n.includes(q) || q.includes(n.split(" ")[0]));
  feed.innerHTML = notice + results
    .map((store) => {
      let html = storeCardTemplate(store);
      const dishes = dishesOf(store);
      if (dishQuery && dishes.length) {
        html += `<div class="dish-row hide-scrollbar">${dishes.map(dishCardTemplate).join("")}</div>`;
      }
      return html;
    })
    .join("");
}

function initHome() {
  render(CUISINES, "#view-home .cuisine-row", cuisineTemplate);
  render(CUISINES, ".results-cuisine-row", cuisineTemplate); // same cards on the results view

  const homeRow = document.querySelector("#view-home .cuisine-row");
  if (homeRow) homeRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".cuisine-item");
    if (!btn) return;
    toggleCuisine(btn.dataset.name);
    if (typeof navigate === "function") navigate("results");
  });
  // Results cuisine tap → toggle in place, stay on results.
  const resultsRow = document.querySelector(".results-cuisine-row");
  if (resultsRow) resultsRow.addEventListener("click", (e) => {
    const btn = e.target.closest(".cuisine-item");
    if (btn) toggleCuisine(btn.dataset.name);
  });

  document.querySelectorAll(".search-bar__input").forEach((input) => {
    input.addEventListener("input", syncChipsFromInput);
    input.addEventListener("focus", stopRotation);
    input.addEventListener("blur", () => { if (!input.value) startRotation(); });
  });

  const homeBar = document.querySelector("#view-home .search-bar");
  if (homeBar) homeBar.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    openSearchPage();
  });
  document.querySelectorAll(".search-clear").forEach((btn) => btn.addEventListener("click", clearSearch));
  document.querySelectorAll(".search-block").forEach((form) => form.addEventListener("submit", (e) => e.preventDefault()));

  document.querySelector("[data-results-back]")?.addEventListener("click", () => {
    clearSearch();
    history.back();
  });

  renderFyp(); // static "You might like" — rendered once, never filtered
  updateSearchState();
  startRotation();

  const C = window.hawkrCatalog;
  const paint = () => { applyCatalog(); renderFyp(); renderResultsFeed(); };
  if (C) C.ready().then(paint, paint);
  else paint();
}

if (window.hawkrCatalog) window.hawkrCatalog.onReady(applyCatalog);

document.addEventListener("DOMContentLoaded", initHome);
