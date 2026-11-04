
import {
  getStallCentreStatus,
  currentClosure,
  livePromotions,
  discountLabel,
  closureDayLabel,
  closureTimeLabel,
} from "../../data/centreStatusData.js";

function esc(value) {
  const div = document.createElement("div");
  div.textContent = value == null ? "" : String(value);
  return div.innerHTML;
}

function noticeHtml(tone, title, text, source) {
  return `
    <section class="centreNotice centreNotice--${tone}">
      <p class="centreNotice__title">${esc(title)}</p>
      <p class="centreNotice__text">${esc(text)}</p>
      ${source ? `<p class="centreNotice__source">${esc(source)}</p>` : ""}
    </section>
  `;
}

function closureNotice(centreName, closure, state) {
  if (state === "closed") {
    return noticeHtml(
      "closed",
      `${centreName} is closed`,
      `Closed until ${closureDayLabel(closure.EndDateTime)}, ${closureTimeLabel(closure.EndDateTime)}. ` +
        `Reason: ${closure.Reason}. Customers cannot order from your stall until it reopens.`,
      "Scheduled by the centre operator."
    );
  }
  return noticeHtml(
    "soon",
    `${centreName} closes ${closureDayLabel(closure.StartDateTime)}`,
    `From ${closureDayLabel(closure.StartDateTime)} at ${closureTimeLabel(closure.StartDateTime)} ` +
      `until ${closureDayLabel(closure.EndDateTime)}, ${closureTimeLabel(closure.EndDateTime)}. ` +
      `Reason: ${closure.Reason}.`,
    "Scheduled by the centre operator."
  );
}

function promotionNotice(centreName, promotion) {
  return noticeHtml(
    "promo",
    `${discountLabel(promotion)} on your stall — ${promotion.Name}`,
    `${centreName} is running this until ${closureDayLabel(promotion.EndDateTime)}. ` +
      `It comes off the customer's bill automatically at checkout, so your takings will ` +
      `read lower per order while it runs.` +
      (promotion.Description ? ` ${promotion.Description}` : ""),
    "Created by the centre operator. You cannot edit or end it."
  );
}

export async function renderCentreNotice(container, stallId, options = {}) {
  if (!container || stallId == null) return null;
  let status;
  try {
    status = await getStallCentreStatus(stallId);
  } catch (_) {
    container.innerHTML = ""; 
    return null;
  }

  const closure = currentClosure(status.closures);
  const promotions = livePromotions(status.promotions);
  const parts = [];

  if (closure) parts.push(closureNotice(status.CentreName, closure.closure, closure.state));
  


  if (options.promotions !== false) {
    promotions.forEach((p) => parts.push(promotionNotice(status.CentreName, p)));
  }

  container.innerHTML = parts.join("");
  return { closure, promotions, centreName: status.CentreName, hawkerId: status.HawkerId };
}
