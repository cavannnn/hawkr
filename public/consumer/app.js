const VIEWS = ["home", "search", "map", "results", "store", "item", "cuisines", "allergies", "profile", "settings", "cart", "favourites", "reviews", "orders", "tickets", "newticket"];
const STORE_KEY = "hawkr:location";

const NEAR_YOU = [
  { name: "Bukit Batok Street 23 BUKIT BATOK INDUSTRIAL PARK 'A'", addr: "", lat: 1.349, lng: 103.749 },
  { name: "Chinatown Complex Food Centre", addr: "335 Smith Street, Singapore 050335", hawkerCentre: true, lat: 1.2826, lng: 103.8436 },
  { name: "Blk 1 Thomson Road", addr: "", lat: 1.325, lng: 103.842 },
];
const RECENTS = [
  { name: "Chinatown Complex Food Centre", addr: "335 Smith Street, Singapore 050335", hawkerCentre: true, lat: 1.2826, lng: 103.8436 },
  { name: "Blk 1 Thomson Road", addr: "", lat: 1.325, lng: 103.842 },
];

/* ---------------- Router ---------------- */
const currentView = () => document.body.dataset.view;

function applyView(view) {
  document.body.dataset.view = view;
  if (view === "map") ensureMap();
}
function transitionTo(view) {
  if (document.startViewTransition) document.startViewTransition(() => applyView(view));
  else applyView(view);
}
function navigate(view) {
  if (currentView() === view) return;
  closeSuggest();
  history.pushState({ view }, "", "#" + view);
  transitionTo(view);
}
window.addEventListener("popstate", (e) => {
  transitionTo((e.state && e.state.view) || "home");
});

/* ---------------- Auto-hiding sticky top bars ---------------- */
function autoHideBar(scroller, bar, hiddenClass, opts) {
  if (!scroller || !bar) return;
  const o = opts || {};
  const hideAfter = o.hideAfter != null ? o.hideAfter : 120; // stay put until past this — a short page never hides its bar
  const showNear = o.showNear != null ? o.showNear : 40;     // this close to the top, always show
  const barOf = typeof bar === "string" ? () => scroller.querySelector(bar) : () => bar;
  let lastY = 0;
  scroller.addEventListener("scroll", () => {
    if (typeof o.paused === "function" && o.paused()) return;
    const el = barOf();
    if (!el) return;
    const y = scroller.scrollTop;
    if (y > lastY && y > hideAfter) el.classList.add(hiddenClass);
    else if (y < lastY - 4 || y < showNear) el.classList.remove(hiddenClass); // -4 = ignore scroll jitter
    lastY = y;
  }, { passive: true });
}
window.autoHideBar = autoHideBar;

/* ---------------- Global location state ---------------- */
let locationState = "unset";       // applied UI state (derived — see refreshLocationState)
let locationPermission = "prompt"; // 'granted' | 'prompt' | 'denied' — GPS permission
let hasLoc = false;                // do we actually HAVE a location value?
const FIELD_STATES = {
  on:     { cls: "setloc-field--on",     arrow: "loc-arrow.svg",        crosshair: true },  // have/allowed location
  unset:  { cls: "setloc-field--unset",  arrow: "loc-arrow-unset.svg",  crosshair: true },  // prompt to set
  denied: { cls: "setloc-field--denied", arrow: "loc-arrow-denied.svg", crosshair: false }, // blocked → manual only
};
function setLocationState(state) {
  locationState = state;
  const s = FIELD_STATES[state] || FIELD_STATES.unset;
  const arrowSrc = "../images/" + s.arrow;

  // Search field (arrow + bg state)
  const field = document.querySelector(".setloc-field");
  if (field) {
    Object.values(FIELD_STATES).forEach((x) => field.classList.remove(x.cls));
    field.classList.add(s.cls);
    const arrow = field.querySelector(".setloc-field__arrow");
    if (arrow) arrow.src = arrowSrc;
  }

  document.querySelectorAll(".location-pill").forEach((pill) => {
    pill.classList.toggle("location-pill--unset", state === "unset");
    const pArrow = pill.querySelector(".location-pill__arrow");
    if (pArrow) pArrow.src = arrowSrc;
  });

  // Crosshair (accent when usable, grey when denied)
  const cross = document.getElementById("to-map");
  if (cross) {
    cross.classList.toggle("is-disabled", !s.crosshair);
    const img = cross.querySelector("img");
    if (img) img.src = s.crosshair ? "../images/crosshair.svg" : "../images/crosshair-disabled.svg";
  }
}
function refreshLocationState() {
  if (locationPermission === "denied") setLocationState("denied");
  else setLocationState(hasLoc ? "on" : "unset");
}
async function initLocationState() {
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const st = await navigator.permissions.query({ name: "geolocation" });
      locationPermission = st.state;
      st.onchange = () => { locationPermission = st.state; refreshLocationState(); }; // live-updates every UI
    } catch (e) { /* permissions API unavailable — treat as prompt */ }
  }
  refreshLocationState();
}

/* ---------------- Search lists ---------------- */
function rowTemplate(place) {
  const isHawker = !!place.hawkerCentre; // building icon only for hawker centres
  const icon = isHawker ? "loc-building.svg" : "loc-pin.svg";
  const iconCls = isHawker ? "loc-result__icon loc-result__icon--wide" : "loc-result__icon";
  const addr = place.addr ? `<p class="loc-result__addr">${place.addr}</p>` : "";
  return `
    <li>
      <button class="loc-result" type="button"
              data-name="${encodeURIComponent(place.name)}" data-lat="${place.lat}" data-lng="${place.lng}">
        <img class="${iconCls}" src="../images/${icon}" alt="">
        <span class="loc-result__text">
          <p class="loc-result__name">${place.name}</p>
          ${addr}
        </span>
      </button>
    </li>`;
}
function renderList(sel, list) {
  const ul = document.querySelector(sel);
  if (ul) ul.innerHTML = list.map(rowTemplate).join("");
}

/* ---------------- Saved location (localStorage) ---------------- */
function loadSaved() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch (e) { return null; }
}
function setPillValue(text) {
  document.querySelectorAll(".location-pill__value").forEach((pill) => {
    pill.classList.remove("skeleton"); // resolve the shimmer
    pill.textContent = text;
  });
}
function saveLocation(loc) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(loc)); } catch (e) {}
  const input = document.querySelector(".setloc-field__input");
  if (input && loc.address) input.value = loc.address;
  if (loc.address) setPillValue(loc.address);
  hasLoc = !!loc.address;
  refreshLocationState(); // now we have a location → blue (unless denied)
}

/* ---------------- Map (center-pin) ---------------- */
const SG_DEFAULT = { lat: 1.3521, lng: 103.8198 };
const SG_BOUNDS = { north: 1.48, south: 1.15, west: 103.59, east: 104.09 }; // keep the pin inside Singapore
let map = null;
let mapInited = false;
let rgTimer = null;
let pendingCenter = null; // where to centre the map after a search pick
let geocoder = null;      // reverse geocoding (Geocoding API)

function setDenied(isDenied) {
  locationPermission = isDenied ? "denied" : "granted";
  if (!isDenied) hasLoc = true; // a successful geolocation IS a location
  refreshLocationState(); // map is NOT greyed — only the field state changes
}
function scheduleReverseGeocode() {
  clearTimeout(rgTimer);
  rgTimer = setTimeout(() => {
    const c = map && map.getCenter();
    if (c) reverseGeocode(c); // guard: map may have no centre (e.g. auth failed)
  }, 400); // debounced billed call
}
async function reverseGeocode(center) {
  const input = document.querySelector(".setloc-field__input");
  if (!input || !center) return;
  if (document.activeElement === input) return; // don't clobber what they're typing
  const coords = `${center.lat().toFixed(5)}, ${center.lng().toFixed(5)}`;
  try {
    if (!geocoder) { const { Geocoder } = await google.maps.importLibrary("geocoding"); geocoder = new Geocoder(); }
    const { results } = await geocoder.geocode({ location: center });
    const best = results && results.find((r) => !r.types.includes("plus_code")); // skip grid Plus Codes
    input.value = best ? best.formatted_address : coords; // nearest real address first, coords last resort
  } catch (err) {
    input.value = coords; // fallback if Geocoding API isn't enabled yet
  }
}
function centerOnDevice() {
  if (!navigator.geolocation) { setDenied(true); return; }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => { setDenied(false); if (map) map.setCenter({ lat: coords.latitude, lng: coords.longitude }); },
    () => setDenied(true),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}
async function ensureMap() {
  if (mapInited) return;
  mapInited = true;
  try {
    const { Map } = await google.maps.importLibrary("maps");
    map = new Map(document.getElementById("map"), {
      center: SG_DEFAULT, zoom: 16, disableDefaultUI: true, clickableIcons: false, gestureHandling: "greedy",
      restriction: { latLngBounds: SG_BOUNDS, strictBounds: false }, // no panning the pin into Johor
    });
    map.addListener("idle", scheduleReverseGeocode);
    if (pendingCenter) { map.setCenter(pendingCenter); pendingCenter = null; } // land on a searched place
    else centerOnDevice(); // auto-centre (no recenter button)
  } catch (err) {
    console.warn("[hawkr] Maps failed to load — showing fallback.", err);
    setDenied(true);
  }
}
function saveCurrentPin() {
  const input = document.querySelector(".setloc-field__input");
  const c = map ? map.getCenter() : null;
  saveLocation({ address: input ? input.value : "", lat: c ? c.lat() : null, lng: c ? c.lng() : null });
}

/* ---------------- Address autocomplete (Places API New) ---------------- */
let placesReady = null;
let sessionToken = null;
let acTimer = null;

async function ensurePlaces() {
  if (!placesReady) placesReady = google.maps.importLibrary("places");
  const lib = await placesReady;
  if (!sessionToken) sessionToken = new lib.AutocompleteSessionToken(); // one billed session per search
  return lib;
}
function onFieldInput(e) {
  clearPending(); // editing invalidates any previous pick → tick hides, crosshair returns
  const q = e.target.value.trim();
  clearTimeout(acTimer);
  if (q.length < 3) { closeSuggest(); return; }
  acTimer = setTimeout(() => fetchSuggestions(q), 250); // debounce keystrokes
}
async function fetchSuggestions(q) {
  try {
    const lib = await ensurePlaces();
    const req = { input: q, sessionToken, includedRegionCodes: ["sg"] };
    if (map && map.getBounds()) req.locationBias = map.getBounds(); // bias to the map view
    const { suggestions } = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions(req);
    renderSuggestions(suggestions || []);
  } catch (err) {
    console.warn("[hawkr] autocomplete failed — is Places API (New) enabled + on the key?", err);
  }
}
function renderSuggestions(suggestions) {
  const ul = document.querySelector(".setloc-suggest");
  if (!ul) return;
  const preds = suggestions.filter((s) => s.placePrediction);
  if (!preds.length) { closeSuggest(); return; }
  ul.innerHTML = preds.map((s, i) => {
    const p = s.placePrediction;
    const main = (p.mainText && p.mainText.text) || (p.text && p.text.text) || "";
    const sub = (p.secondaryText && p.secondaryText.text) || "";
    return `
      <li>
        <button class="suggest-item" type="button" data-idx="${i}">
          <img class="suggest-item__icon" src="../images/loc-pin.svg" alt="">
          <span>
            <span class="suggest-item__main">${main}</span>
            ${sub ? `<br><span class="suggest-item__sub">${sub}</span>` : ""}
          </span>
        </button>
      </li>`;
  }).join("");
  ul._preds = preds;
  ul.classList.add("is-open");
}
function closeSuggest() {
  const ul = document.querySelector(".setloc-suggest");
  if (ul) { ul.classList.remove("is-open"); ul.innerHTML = ""; ul._preds = null; }
}
async function selectSuggestion(idx) {
  const ul = document.querySelector(".setloc-suggest");
  const s = ul && ul._preds && ul._preds[idx];
  if (!s || !s.placePrediction) return;
  try {
    const place = s.placePrediction.toPlace();
    await place.fetchFields({ fields: ["location", "formattedAddress"] });
    sessionToken = null; // end the billing session on selection
    const c = place.location;
    selectPlace({ address: place.formattedAddress, lat: c.lat(), lng: c.lng() }); // fill + valid tick, STAY (no map jump)
  } catch (err) {
    console.warn("[hawkr] place details failed", err);
  }
}

/* ---------------- Selection flow (select → fill + valid tick → commit) ---------------- */
let pendingLocation = null;
function selectPlace(loc) {
  pendingLocation = loc;
  const input = document.querySelector(".setloc-field__input");
  if (input && loc.address) input.value = loc.address;
  document.body.classList.add("has-pending"); // crosshair → tick (the valid ✓); stays on this screen
  closeSuggest();
  if (input) input.blur();
}
function clearPending() {
  pendingLocation = null;
  document.body.classList.remove("has-pending");
}
function commitPending() {
  if (pendingLocation) saveLocation(pendingLocation); // updates pill + state
  clearPending();
  history.back(); // done → back to home
}
async function validateTyped() {
  const input = document.querySelector(".setloc-field__input");
  const q = input && input.value.trim();
  if (!q || pendingLocation) return; // empty, or already validated via a pick
  try {
    if (!geocoder) { const { Geocoder } = await google.maps.importLibrary("geocoding"); geocoder = new Geocoder(); }
    const { results } = await geocoder.geocode({ address: q, componentRestrictions: { country: "SG" } });
    const best = results && results.find((r) => !r.types.includes("plus_code"));
    if (best) {
      const c = best.geometry.location;
      selectPlace({ address: best.formatted_address, lat: c.lat(), lng: c.lng() }); // validated → tick
    }
    // no match → leave unvalidated: tick stays off, typed text isn't committable
  } catch (err) {
    console.warn("[hawkr] address validation failed — is Geocoding API enabled?", err);
  }
}

/* ---------------- Wiring ---------------- */
function initApp() {
  renderList('.loc-results[data-list="near"]', NEAR_YOU);
  renderList('.loc-results[data-list="recent"]', RECENTS);

  const saved = loadSaved();
  if (saved && saved.address) {
    hasLoc = true;
    setPillValue(saved.address);
    const input = document.querySelector(".setloc-field__input");
    if (input) input.value = saved.address;
  } else {
    setPillValue("No location"); // resolve the shimmer to the not-set state
  }
  initLocationState(); // denied → grey; have-location → blue; else purple

  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) { e.preventDefault(); navigate(nav.dataset.nav); return; }

    if (e.target.closest("#confirm")) { // the tick = commit
      e.preventDefault();
      if (currentView() === "map") { saveCurrentPin(); history.back(); } // map: save the pin, close
      else commitPending();                                              // search: commit the selected place
      return;
    }

    if (e.target.closest("[data-back]")) {
      e.preventDefault();
      if (currentView() === "map") saveCurrentPin(); // save-on-exit from the map
      clearPending();
      history.back();
      return;
    }

    const row = e.target.closest(".loc-result");
    if (row) {
      e.preventDefault();
      selectPlace({ address: decodeURIComponent(row.dataset.name), lat: +row.dataset.lat, lng: +row.dataset.lng });
      return; // fill + valid tick + STAY (tick commits, no auto-jump home)
    }

    const sug = e.target.closest(".suggest-item");
    if (sug) { e.preventDefault(); selectSuggestion(+sug.dataset.idx); return; }
  });

  const form = document.querySelector(".setloc-field");
  if (form) form.addEventListener("submit", (e) => { e.preventDefault(); validateTyped(); }); // Enter = geocode-to-check

  const input = document.querySelector(".setloc-field__input");
  if (input) input.addEventListener("input", onFieldInput);

  const initial = (location.hash || "").replace("#", "");
  const start = VIEWS.includes(initial) ? initial : "home";
  history.replaceState({ view: start }, "", "#" + start);
  applyView(start);
}

document.addEventListener("DOMContentLoaded", initApp);

/* ---------------- bottom-sheet primitive ---------------- */
function openSheet(el) {
  if (!el) return;
  el.hidden = false;
  void el.offsetWidth; // reflow so the slide-up transitions from the hidden state
  el.classList.add("is-open");
}
function closeSheet(el) {
  if (!el) return;
  el.classList.remove("is-open");
  setTimeout(() => { el.hidden = true; }, 300); // after the slide-out
}
function wireSheetGesture(el, onDismiss) {
  const sheet = el?.querySelector(".far-modal__sheet");
  if (!sheet || sheet.dataset.gesture) return;
  sheet.dataset.gesture = "1"; // idempotent — wire once per element
  let down = false, startY = 0, dy = 0, startT = 0;
  sheet.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return; // buttons keep their own taps
    down = true; startY = e.clientY; dy = 0; startT = Date.now();
    sheet.style.transition = "none"; // follow the finger 1:1
    try { sheet.setPointerCapture(e.pointerId); } catch (_) {}
  });
  sheet.addEventListener("pointermove", (e) => {
    if (!down) return;
    dy = e.clientY - startY;
    sheet.style.transform = "translateY(" + (dy > 0 ? dy : dy * 0.2) + "px)"; // down follows, up resists
  });
  const settle = () => {
    if (!down) return;
    down = false;
    sheet.style.transition = "";
    const flick = dy > 40 && Date.now() - startT < 250;
    if (dy > 110 || flick) {
      sheet.style.transition = "transform 0.28s var(--ease-standard)";
      sheet.style.transform = "translateY(100%)";
      el.classList.remove("is-open"); // fade the scrim out with it
      setTimeout(() => { el.hidden = true; sheet.style.transform = ""; sheet.style.transition = ""; }, 300);
      if (onDismiss) onDismiss();
    } else {
      sheet.style.transition = "transform var(--duration-warm) var(--ease-spring)";
      sheet.style.transform = "translateY(0)";
      setTimeout(() => { sheet.style.transform = ""; sheet.style.transition = ""; }, 340);
    }
  };
  sheet.addEventListener("pointerup", settle);
  sheet.addEventListener("pointercancel", settle);
}
window.openSheet = openSheet;
window.closeSheet = closeSheet;
window.wireSheetGesture = wireSheetGesture;

/* ---------------- "Far from your pill" reconcile modal ---------------- */
function showFarModal(browsing, pillPlace, coords) {
  const modal = document.getElementById("far-modal");
  if (!modal) return;
  const pillTxt = pillPlace || document.querySelector(".location-pill__value")?.textContent.trim() || "your spot";
  modal.querySelector(".far-browsing").textContent = browsing || "there";
  modal.querySelector(".far-pill").textContent = pillTxt;
  modal.dataset.browsing = browsing || "";
  modal.dataset.blat = coords && coords.lat != null ? coords.lat : "";
  modal.dataset.blng = coords && coords.lng != null ? coords.lng : "";
  openSheet(modal);
}
function hideFarModal() { closeSheet(document.getElementById("far-modal")); }
window.showFarModal = showFarModal; // manual trigger until advanced search wires it

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("far-update")?.addEventListener("click", () => {
    const modal = document.getElementById("far-modal");
    const b = modal?.dataset.browsing;
    if (b) saveLocation({                                    // move the pill to the browsed place
      address: b,
      lat: modal.dataset.blat ? +modal.dataset.blat : null,  // with exact coords when we have them
      lng: modal.dataset.blng ? +modal.dataset.blng : null,
    });
    hideFarModal();
  });
  document.getElementById("far-keep")?.addEventListener("click", hideFarModal);
  document.querySelector("[data-far-dismiss]")?.addEventListener("click", hideFarModal); // tap scrim = keep

  wireSheetGesture(document.getElementById("far-modal"), null);
});
