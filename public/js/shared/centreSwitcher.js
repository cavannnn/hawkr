
import { getMyCentres } from "../../data/centresData.js";

const ACTIVE_CENTRE_KEY = "activeCentreId";
const ICONS = new URL("../icons/", import.meta.url).href;

export function getActiveCentreId() {
  return localStorage.getItem(ACTIVE_CENTRE_KEY) || null;
}

export function setActiveCentreId(hawkerId) {
  const id = String(hawkerId);
  localStorage.setItem(ACTIVE_CENTRE_KEY, id);
  return id;
}

export function clearActiveCentre() {
  localStorage.removeItem(ACTIVE_CENTRE_KEY);
}

export function resolveActiveCentre(centres) {
  const list = Array.isArray(centres) ? centres : [];

  if (list.length === 0) {
    clearActiveCentre();
    return null;
  }

  const stored = getActiveCentreId();
  const chosen = list.find((c) => String(c.HawkerId) === stored) || list[0];
  setActiveCentreId(chosen.HawkerId);
  return chosen;
}

let centresPromise = null;

function getCentres() {
  if (!centresPromise) centresPromise = getMyCentres();
  return centresPromise;
}

export async function getActiveCentre() {
  return resolveActiveCentre(await getCentres());
}


function buildLogo() {
  const chip = document.createElement("span");
  chip.className = "ocCentre__logo";

  const glyph = document.createElement("span");
  glyph.className = "icon";
  glyph.style.setProperty("--icon", `url(${ICONS}organisation.svg)`);
  glyph.setAttribute("aria-hidden", "true");

  chip.appendChild(glyph);
  return chip;
}

function buildRow(centre, isCurrent) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "ocCentre";
  row.setAttribute("role", "option");
  row.setAttribute("aria-selected", isCurrent ? "true" : "false");
  row.dataset.centreId = String(centre.HawkerId);

  const text = document.createElement("span");
  text.className = "ocCentre__text";

  const name = document.createElement("span");
  name.className = "ocCentre__name";
  name.textContent = centre.Name || "";

  text.appendChild(name);
  row.append(buildLogo(), text);

  if (isCurrent) {
    const chevrons = document.createElement("span");
    chevrons.className = "icon icon--sm ocCentre__switch";
    chevrons.style.setProperty("--icon", `url(${ICONS}switcher.svg)`);
    chevrons.setAttribute("aria-hidden", "true");
    row.appendChild(chevrons);
  }

  return row;
}

function renderMessage(panel, text) {
  const line = document.createElement("p");
  line.className = "ocCentreSwitcher__empty";
  line.textContent = text;
  panel.replaceChildren(line);
}

function render(panel, centres, active) {
  panel.replaceChildren();

  if (centres.length === 0) {
    renderMessage(panel, "No centres assigned yet.");
    return;
  }

  const activeId = active ? String(active.HawkerId) : null;
  centres
    .filter((c) => String(c.HawkerId) !== activeId)
    .forEach((c) => panel.appendChild(buildRow(c, false)));

  if (active) panel.appendChild(buildRow(active, true));
}

export async function initCentreSwitcher() {
  const trigger = document.querySelector(".ocRail [data-centre-switcher]");
  if (!trigger || trigger.__centreSwitcher) return null;
  const rail = trigger.closest(".ocRail");
  if (!rail) return null;
  trigger.__centreSwitcher = true;

  const nameEl = trigger.querySelector("[data-active-centre-name]");

  const panel = document.createElement("div");
  panel.className = "ocCentreSwitcher";
  panel.id = "ocCentreSwitcher";
  panel.setAttribute("role", "listbox");
  panel.setAttribute("aria-label", "Your hawker centres");
  panel.hidden = true;
  rail.appendChild(panel);

  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", panel.id);

  const items = () => Array.from(panel.querySelectorAll("button"));

  function open() {
    if (!panel.hidden) return;
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    items()[0]?.focus();
  }

  function close({ restoreFocus = true } = {}) {
    if (panel.hidden) return;

    if (restoreFocus) trigger.focus();
    else if (panel.contains(document.activeElement)) document.activeElement.blur();

    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  trigger.addEventListener("click", () => {
    if (panel.hidden) open();
    else close();
  });


  trigger.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      open();
    }
  });


  document.addEventListener("pointerdown", (e) => {
    if (panel.hidden) return;
    if (panel.contains(e.target) || trigger.contains(e.target)) return;
    close({ restoreFocus: false });
  });

  document.addEventListener("keydown", (e) => {
    if (panel.hidden || e.key !== "Escape") return;
    close();
  });

  panel.addEventListener("keydown", (e) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();

    const all = items();
    if (all.length === 0) return;
    const at = all.indexOf(document.activeElement);
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? all.length - 1
      : e.key === "ArrowDown" ? (at + 1) % all.length
      : (at - 1 + all.length) % all.length;
    all[next]?.focus();
  });

  panel.addEventListener("click", (e) => {
    const row = e.target.closest("[data-centre-id]");
    if (!row) return;

    const picked = row.dataset.centreId;
    if (picked === getActiveCentreId()) {
      close();
      return;
    }

    setActiveCentreId(picked);

    window.location.reload();
  });

  
  renderMessage(panel, "Loading your centres…");

  let centres;
  try {
    centres = await getCentres();
  } catch (error) {
    
    console.error("Could not load this operator's hawker centres:", error);
    renderMessage(panel, "Could not load your centres.");
    if (nameEl) nameEl.textContent = "";
    trigger.setAttribute("aria-label", "Switch hawker centre");
    return { centres: null, active: null, error };
  }

  const active = resolveActiveCentre(centres);

  if (nameEl) {
    

    nameEl.textContent = active ? active.Name : "";
  }

  trigger.setAttribute(
    "aria-label",
    active ? `Switch hawker centre: ${active.Name}` : "Switch hawker centre",
  );

  render(panel, centres, active);
  return { centres, active };
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initCentreSwitcher());
} else {
  initCentreSwitcher();
}
