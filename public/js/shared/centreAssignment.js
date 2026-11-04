
import { getMyCentres } from "../../data/centresData.js";

const SETTINGS_HREF = "/operator/Settings/operatorSettings.html";
let answer = null;
let asked = null;

export function hasNoCentres() {
  if (asked) return asked;
  asked = getMyCentres()
    .then((centres) => {
      answer = Array.isArray(centres) && centres.length === 0;
      return answer;
    })
    .catch(() => {
      answer = false;
      return false;
    });
  return asked;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function unassignedEmptyState(sentence) {
  return `<div class="emptyState">
    <p class="emptyStateTitle">No centres assigned</p>
    <p class="emptyStateBody">${esc(sentence)}</p>
    <a class="btn btn--primary btn--md" href="${SETTINGS_HREF}">Choose your centres</a>
  </div>`;
}

function paint(container, sentence) {
  const html = unassignedEmptyState(sentence);
  const tag = container.tagName;
  container.innerHTML = tag === "UL" || tag === "OL" ? `<li>${html}</li>` : html;
}

export function explainIfUnassigned(container, sentence) {
  if (!container) return false;

  if (answer === true) {
    paint(container, sentence);
    return true;
  }
  if (answer === false) return false;

  const drawn = container.innerHTML;
  hasNoCentres().then((none) => {
    if (!none || !container.isConnected) return;
    if (container.innerHTML !== drawn) return;
    paint(container, sentence);
  });
  return false;
}
