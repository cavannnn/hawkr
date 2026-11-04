import { getSession } from "../../data/session.js";
import { getMyStalls } from "../../data/shared.js";

const ACTIVE_STALL_KEY = "activeStallId";
const ICONS = new URL("../icons/", import.meta.url).href;
const APPLY_URL = new URL("../../vendor/Stall/vendorStallApply.html", import.meta.url).href;

export function getActiveStallId() {
  return localStorage.getItem(ACTIVE_STALL_KEY) || null;
}


export function setActiveStallId(stallId) {
  const id = String(stallId);
  localStorage.setItem(ACTIVE_STALL_KEY, id);
  return id;
}

export function clearActiveStall() {
  localStorage.removeItem(ACTIVE_STALL_KEY);
}

export function resolveActiveStall(stalls) {
  const list = Array.isArray(stalls) ? stalls : [];

  if (list.length === 0) {
    clearActiveStall();
    return null;
  }

  const stored = getActiveStallId();
  const chosen = list.find((s) => String(s.stallId) === stored) || list[0];
  setActiveStallId(chosen.stallId);
  return chosen;
}

function stallName(stall) {
  return stall?.stallName || "";
}

function stallMeta(stall) {
  return stall?.centreName || stall?.address || "";
}

function buildLogo(stall) {
  if (stall.imageUrl) {
    const img = document.createElement("img");
    img.className = "stallSwitcher__logo";
    img.src = stall.imageUrl;
    img.alt = "";
    return img;
  }

  const chip = document.createElement("span");
  chip.className = "stallSwitcher__logo";
  const glyph = document.createElement("span");
  glyph.className = "icon";
  glyph.style.setProperty("--icon", `url(${ICONS}vendor.svg)`);
  glyph.setAttribute("aria-hidden", "true");
  chip.appendChild(glyph);
  return chip;
}

function buildRow(stall, isCurrent) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "stallSwitcher__row";
  row.setAttribute("role", "menuitemradio");
  row.setAttribute("aria-checked", isCurrent ? "true" : "false");
  row.dataset.stallId = String(stall.stallId);

  const text = document.createElement("span");
  text.className = "stallSwitcher__text";

  const name = document.createElement("span");
  name.className = "stallSwitcher__name";
  name.textContent = stallName(stall);

  const meta = document.createElement("span");
  meta.className = "stallSwitcher__meta";
  meta.textContent = stallMeta(stall);

  text.append(name, meta);
  row.append(buildLogo(stall), text);
  return row;
}

function buildPendingRow(request) {
  const row = document.createElement("div");
  row.className = "stallSwitcher__row stallSwitcher__row--pending";
  row.setAttribute("role", "menuitem");
  row.setAttribute("aria-disabled", "true");
  row.tabIndex = -1;

  const text = document.createElement("span");
  text.className = "stallSwitcher__text";

  const name = document.createElement("span");
  name.className = "stallSwitcher__name";
  name.textContent = stallName(request);

  const meta = document.createElement("span");
  meta.className = "stallSwitcher__meta";
  meta.textContent = stallMeta(request);

  text.append(name, meta);

  const chip = document.createElement("span");
  chip.className = "stallSwitcher__pending";
  chip.textContent = "Pending";

  row.append(buildLogo(request), text, chip);
  return row;
}

function buildAddRow() {
  const add = document.createElement("button");
  add.type = "button";
  add.className = "stallSwitcher__add";
  add.setAttribute("role", "menuitem");
  add.dataset.addStall = "";

  const slot = document.createElement("span");
  slot.className = "stallSwitcher__addIcon";
  const plus = document.createElement("span");
  plus.className = "icon";
  plus.style.setProperty("--icon", `url(${ICONS}add.svg)`);
  plus.setAttribute("aria-hidden", "true");
  slot.appendChild(plus);
  add.append(slot, document.createTextNode("Add account"));
  return add;
}


function render(panel, stalls, pending, active) {
  panel.replaceChildren();

  const activeId = active ? String(active.stallId) : null;
  if (active) panel.appendChild(buildRow(active, true));

  stalls
    .filter((s) => String(s.stallId) !== activeId)
    .forEach((s) => panel.appendChild(buildRow(s, false)));

  pending.forEach((r) => panel.appendChild(buildPendingRow(r)));

  panel.appendChild(buildAddRow());
}

export async function initStallSwitcher() {
  const trigger = document.querySelector(".topBarPill button.topBarBrand");
  if (!trigger || trigger.__stallSwitcher) return null;
  const bar = trigger.closest(".topBar");
  if (!bar) return null;
  trigger.__stallSwitcher = true;
  const session = getSession();
  if (!session) return null;

  const nameEl = trigger.querySelector(".topBarBrand__name");

  if (nameEl) {
    nameEl.textContent = "\u00A0";
    nameEl.classList.add("skeleton");
  }

  const panel = document.createElement("div");
  panel.className = "stallSwitcher";
  panel.id = "stallSwitcher";
  panel.setAttribute("role", "menu");
  


  panel.setAttribute("aria-label", "Your stalls and applications");
  panel.hidden = true;
  bar.appendChild(panel);

  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", panel.id);

  

  const items = () => Array.from(panel.querySelectorAll('[role^="menuitem"]'));

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
    if (e.key === "ArrowDown") {
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
    const at = all.indexOf(document.activeElement);
    const next =
      e.key === "Home" ? 0
      : e.key === "End" ? all.length - 1
      : e.key === "ArrowDown" ? (at + 1) % all.length
      : (at - 1 + all.length) % all.length;
    all[next]?.focus();
  });

  panel.addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-stall]");
    if (add) {
      close();

      const wanted = document.dispatchEvent(
        new CustomEvent("hawkr:add-stall", { bubbles: true, cancelable: true }),
      );
      if (wanted) window.location.href = APPLY_URL;
      return;
    }

    const row = e.target.closest("[data-stall-id]");
    if (!row) return;

    const picked = row.dataset.stallId;
    if (picked === getActiveStallId()) {
      close();
      return;
    }

    setActiveStallId(picked);

    window.location.reload();
  });

  let stalls = [];
  let requests = [];
  try {
    const mine = await getMyStalls(session.uid);
    stalls = Array.isArray(mine?.stalls) ? mine.stalls : [];
    requests = Array.isArray(mine?.requests) ? mine.requests : [];
  } catch (err) {
    console.error("Stall switcher could not load this vendor's stalls:", err);
  }

  const pending = requests.filter((r) => r.status === "pending");

  const active = resolveActiveStall(stalls);

  if (nameEl) {
    nameEl.classList.remove("skeleton");
    
    nameEl.textContent = active ? stallName(active) : "";
  }


  trigger.setAttribute(
    "aria-label",
    active ? `Switch stall: ${stallName(active)}` : "Switch stall",
  );

  render(panel, stalls, pending, active);
  return { stalls, pending, active };
}


if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => initStallSwitcher());
} else {
  initStallSwitcher();
}
