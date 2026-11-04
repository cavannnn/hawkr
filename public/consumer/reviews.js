/* reviews.js — #view-reviews, the customer's reviews. */
import {
  COMMENT_MAX,
  RATING_MAX,
  getReviewPrompt,
  getOrderHistory,
  submitReview,
  updateReview,
  deleteReview,
  recordOrder,
  getLatestOrderId,
  CENTRE_COMMENT_MAX,
  FACILITY_TAGS,
  getCentresForFeedback,
  getMyCentreFeedback,
  submitCentreFeedback,
} from "../data/reviewsData.js";
import { getSession } from "../data/session.js";
import { showConfirm, showToast } from "../assets/js/toast.js";

const doc = document;

const WORDS = ["Not good", "Poor", "Okay", "Good", "Loved it"];

const FACILITY_LABELS = {
  Cleanliness: "Cleanliness",
  Seating: "Seating",
  Toilets: "Toilets",
  Ventilation: "Ventilation",
  Queue: "Queue / crowd",
  Other: "Something else",
};

let orderId = null;
let mode = "orders";
let renderToken = 0;
let centre = null;

function view() { return doc.getElementById("view-reviews"); }

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function whenText(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" }) +
    ", " + d.toLocaleTimeString("en-SG", { hour: "numeric", minute: "2-digit" });
}

function money(value) {
  return value == null ? "" : "$" + Number(value).toFixed(2);
}

/* ---------------- templates ---------------- */

function starsHtml(rating, done) {
  let out = "";
  for (let i = 1; i <= RATING_MAX; i++) {
    const filled = i <= rating;
    out +=
      '<button class="rv-star" type="button" role="radio" data-star="' + i + '"' +
      ' aria-checked="' + (i === rating ? "true" : "false") + '"' +
      ' aria-label="' + i + (i === 1 ? " star" : " stars") + '"' +
      (done ? " disabled aria-disabled=\"true\"" : "") + ">" +
      '<img class="rv-star__icon" src="../images/' + (filled ? "star.svg" : "star-empty.svg") + '" alt="">' +
      "</button>";
  }
  return out;
}

function itemsLine(items) {
  return (items || [])
    .map(function (i) { return esc(i.itemName) + " ×" + i.quantity; })
    .join(" · ");
}

function orderRowHtml(row) {
  const when = whenText(row.placedAt);
  const bits = [];
  if (row.stallName) bits.push(esc(row.stallName));
  bits.push(row.itemCount === 1 ? "1 item" : row.itemCount + " items");

  return (
    '<button class="rv-order" type="button" data-order="' + esc(row.orderId) + '">' +
      '<span class="rv-order__main">' +
        '<span class="rv-order__when">' + (when ? esc(when) : "Order #" + esc(row.orderId)) + "</span>" +
        '<span class="rv-order__what">' + bits.join(" · ") + "</span>" +
      "</span>" +
      '<span class="rv-order__right">' +
        (row.total == null ? "" : '<span class="rv-order__total">' + esc(money(row.total)) + "</span>") +
        '<img class="rv-order__chev" src="../images/Chevron right.svg" alt="">' +
      "</span>" +
    "</button>"
  );
}

function cardHtml(entry) {
  const done = !!entry.reviewed;
  const word = entry.rating ? WORDS[entry.rating - 1] : "";
  const thumb = entry.image
    ? '<img class="rv-card__thumb" src="' + esc(entry.image) + '" alt="">'
    : "";
  const stamp = (entry.edited ? "Edited · " : "Posted · ") + word;

  return (
    '<article class="rv-card' + (done ? " is-done" : "") + '" data-stall="' + esc(entry.stallId) + '">' +
      '<div class="rv-card__stall">' +
        thumb +
        '<span class="rv-card__who">' +
          '<h2 class="rv-card__name">' + esc(entry.stallName) + "</h2>" +
          (entry.centreName ? '<span class="rv-card__where">' + esc(entry.centreName) + "</span>" : "") +
        "</span>" +
      "</div>" +

      '<p class="rv-card__items">' + itemsLine(entry.items) + "</p>" +

      '<div class="rv-rate">' +
        '<div class="rv-stars" role="radiogroup" aria-label="Your rating for ' + esc(entry.stallName) + '">' +
          starsHtml(entry.rating, done) +
        "</div>" +
        '<span class="rv-stars__word" data-word>' + esc(word) + "</span>" +
      "</div>" +

      '<p class="rv-hint">Tap a star to rate. A comment is optional.</p>' +

      '<div class="rv-field">' +
        '<textarea class="rv-comment" data-comment rows="3" maxlength="' + COMMENT_MAX + '"' +
          ' aria-label="Your comment for ' + esc(entry.stallName) + '"' +
          ' placeholder="How was the food? (optional)">' + esc(entry.comment || "") + "</textarea>" +
        '<span class="rv-count" data-count>0/' + COMMENT_MAX + "</span>" +
      "</div>" +

      '<p class="rv-error" data-error hidden></p>' +

      '<div class="rv-save">' +
        '<button class="rv-cancel" type="button" data-cancel>Cancel</button>' +
        '<button class="rv-post" type="button" data-post disabled>Post review</button>' +
      "</div>" +

      '<p class="rv-done"><img class="rv-done__tick" src="../images/check.svg" alt="">' +
        '<span data-done-text>' + (done ? esc(stamp) : "") + "</span></p>" +
      '<p class="rv-said" data-said' + (done && entry.comment ? "" : " hidden") + ">" +
        (entry.comment ? "“" + esc(entry.comment) + "”" : "") +
      "</p>" +

      '<div class="rv-acts"' + (done && entry.feedbackId ? "" : " hidden") + ">" +
        '<button class="rv-act" type="button" data-edit>' +
          '<img class="rv-act__icon" src="../images/edit-pencil.svg" alt="">Edit' +
        "</button>" +
        '<button class="rv-act rv-act--del" type="button" data-delete>Delete</button>' +
      "</div>" +
    "</article>"
  );
}

function centreRowHtml(row, mine) {
  const count = mine.filter(function (m) { return String(m.hawkerId) === String(row.hawkerId); }).length;
  const sub = count
    ? (count === 1 ? "You've rated this once" : "You've rated this " + count + " times")
    : "Not rated by you yet";

  return (
    '<button class="rv-order" type="button" data-centre="' + esc(row.hawkerId) + '"' +
      ' data-centre-name="' + esc(row.name) + '">' +
      '<span class="rv-order__main">' +
        '<span class="rv-order__when">' + esc(row.name) + "</span>" +
        '<span class="rv-order__what">' + sub + "</span>" +
      "</span>" +
      '<span class="rv-order__right">' +
        '<img class="rv-order__chev" src="../images/Chevron right.svg" alt="">' +
      "</span>" +
    "</button>"
  );
}

function centreFormHtml(target) {
  const options = FACILITY_TAGS.map(function (tag) {
    return '<option value="' + esc(tag) + '">' + esc(FACILITY_LABELS[tag] || tag) + "</option>";
  }).join("");

  return (
    '<article class="rv-card" data-centre-card>' +
      '<div class="rv-card__stall">' +
        '<span class="rv-card__who">' +
          '<h2 class="rv-card__name">' + esc(target.name) + "</h2>" +
          '<span class="rv-card__where">Hawker centre</span>' +
        "</span>" +
      "</div>" +

      '<div class="rv-rate">' +
        '<div class="rv-stars" role="radiogroup" aria-label="Your rating for ' + esc(target.name) + '">' +
          starsHtml(0, false) +
        "</div>" +
        '<span class="rv-stars__word" data-word></span>' +
      "</div>" +

      '<p class="rv-hint">Tap a star to rate, then tell us what it is about.</p>' +

      '<div class="rv-field">' +
        '<label class="rv-card__where" for="rv-facility">What is this about?</label>' +
        '<select class="rv-comment" id="rv-facility" data-facility>' + options + "</select>" +
      "</div>" +

      '<div class="rv-field">' +
        '<textarea class="rv-comment" data-comment rows="3" maxlength="' + CENTRE_COMMENT_MAX + '"' +
          ' aria-label="Your comment for ' + esc(target.name) + '"' +
          ' placeholder="Any comments? (optional)"></textarea>' +
        '<span class="rv-count" data-count>0/' + CENTRE_COMMENT_MAX + "</span>" +
      "</div>" +

      '<p class="rv-error" data-error hidden></p>' +

      '<div class="rv-save">' +
        '<button class="rv-cancel" type="button" data-centre-cancel>Cancel</button>' +
        '<button class="rv-post" type="button" data-centre-post disabled>Send feedback</button>' +
      "</div>" +
    "</article>"
  );
}

function skeletonHtml() {
  return (
    '<article class="rv-card" aria-hidden="true">' +
      '<div class="rv-card__stall">' +
        '<span class="rv-card__thumb skeleton"></span>' +
        '<span class="rv-card__who">' +
          '<h2 class="rv-card__name skeleton">Stall name</h2>' +
          '<span class="rv-card__where skeleton">Hawker centre</span>' +
        "</span>" +
      "</div>" +
      '<p class="rv-card__items skeleton">One dish ×1</p>' +
    "</article>"
  );
}

function orderSkeletonHtml() {
  return new Array(3).fill(
    '<span class="rv-order skeleton" aria-hidden="true" style="height:64px"></span>'
  ).join("");
}

/* ---------------- the empty / note state ---------------- */
function setNote(title, subHtml, ctaLabel, ctaKind) {
  const v = view();
  v.querySelector(".rv-empty__ttl").textContent = title;
  v.querySelector(".rv-empty__sub").innerHTML = subHtml;
  const cta = v.querySelector(".rv-empty__cta");
  cta.textContent = ctaLabel || "";
  cta.hidden = !ctaLabel;
  cta.dataset.rvCta = ctaKind || "browse";
  v.setAttribute("data-empty", "");
}

/* ---------------- rendering ---------------- */

function setHead(title, sub) {
  const v = view();
  v.querySelector(".rv-title").textContent = title;
  v.querySelector(".rv-sub").textContent = sub;
}

function setSummary(entries) {
  const v = view();
  const end = v.querySelector(".rv-end");
  const pending = entries.filter(function (e) { return !e.reviewed; }).length;

  let sub;
  if (!pending) {
    sub = "You've reviewed every stall on this order. Tap Edit to change what you said.";
  } else if (entries.length > 1) {
    sub = "You bought from " + entries.length + " stalls on this order. Each one gets its own review.";
  } else {
    sub = "You bought from one stall on this order. Tell them how it went.";
  }
  setHead("How was it?", sub);

  end.hidden = pending > 0;
}

function refreshSummary() {
  const cards = Array.from(view().querySelectorAll(".rv-card"));
  setSummary(cards.map(function (c) {
    return { reviewed: c.classList.contains("is-done") || c.classList.contains("is-editing") };
  }));
}

/** The list of past orders. */
async function renderOrders() {
  const v = view();
  const list = v.querySelector(".rv-orders");
  if (!list) return;
  const token = ++renderToken;

  setHead("Your orders", "Pick an order to review the stalls you bought from.");
  v.removeAttribute("data-empty");

  if (!getSession()) {
    list.innerHTML = "";
    setNote(
      "Sign in to see your orders",
      "Reviews are tied to your account, so the stall<br>knows whose meal it is you're talking about.",
      "Sign in",
      "signin",
    );
    return;
  }

  list.innerHTML = orderSkeletonHtml();

  let rows;
  try {
    rows = await getOrderHistory();
  } catch (err) {
    if (token !== renderToken) return;
    list.innerHTML = "";
    setNote(
      "Couldn't load your orders",
      esc(err && err.message ? err.message : "Something went wrong.") + "<br>Try again in a moment.",
      "Try again",
      "retry",
    );
    return;
  }
  if (token !== renderToken) return;

  if (!rows.length) {
    list.innerHTML = "";
    setNote(
      "Nothing to review yet",
      "Reviews open up once you've ordered.<br>Buy from a stall and we'll ask how it went.",
      "Browse stalls",
      "browse",
    );
    return;
  }

  list.innerHTML = rows.map(orderRowHtml).join("");
}

/** One order's stalls. */
async function renderCards() {
  const v = view();
  const list = v.querySelector(".rv-list");
  if (!list) return;
  const token = ++renderToken;

  setHead("How was it?", "");
  list.innerHTML = skeletonHtml();
  v.removeAttribute("data-empty");

  let entries;
  try {
    entries = orderId ? await getReviewPrompt(orderId) : [];
  } catch (err) {
    if (token !== renderToken) return;
    list.innerHTML = "";
    setNote(
      "Couldn't open that order",
      esc(err && err.message ? err.message : "Something went wrong.") + "<br>Try again in a moment.",
      "Try again",
      "retry",
    );
    return;
  }
  if (token !== renderToken) return;

  if (!entries.length) {
    list.innerHTML = "";
    setNote(
      "Nothing to review on this order",
      "None of these lines can be traced back to a stall,<br>so there is nobody for a review to be about.",
      "Back to your orders",
      "orders",
    );
    return;
  }

  list.innerHTML = entries.map(cardHtml).join("");
  entries.forEach(function (entry) {
    const card = list.querySelector('[data-stall="' + entry.stallId + '"]');
    if (!card) return;
    card._rating = entry.reviewed ? entry.rating : 0;
    card._feedbackId = entry.feedbackId || null;
    card._saved = { rating: entry.rating || 0, comment: entry.comment || "" };
    card._edited = !!entry.edited;
    syncPost(card);
    syncCount(card);
  });
  setSummary(entries);
}

async function renderCentres() {
  const v = view();
  const list = v.querySelector(".rv-centres");
  if (!list) return;
  const token = ++renderToken;

  setHead("Rate a hawker centre", "Pick the centre you want to give feedback on.");
  v.removeAttribute("data-empty");

  if (!getSession()) {
    list.innerHTML = "";
    setNote(
      "Sign in to rate a centre",
      "Feedback is tied to your account, so the operator<br>knows it came from a real visit.",
      "Sign in",
      "signin",
    );
    return;
  }

  list.innerHTML = orderSkeletonHtml();

  let rows, mine;
  try {
    [rows, mine] = await Promise.all([getCentresForFeedback(), getMyCentreFeedback()]);
  } catch (err) {
    if (token !== renderToken) return;
    list.innerHTML = "";
    setNote(
      "Couldn't load hawker centres",
      esc(err && err.message ? err.message : "Something went wrong.") + "<br>Try again in a moment.",
      "Try again",
      "retry",
    );
    return;
  }
  if (token !== renderToken) return;

  if (!rows.length) {
    list.innerHTML = "";
    setNote("No hawker centres yet", "There is nothing here to rate right now.", "Back", "orders");
    return;
  }

  list.innerHTML = rows.map(function (r) { return centreRowHtml(r, mine); }).join("");
}

function renderCentreForm() {
  const v = view();
  const host = v.querySelector(".rv-centre-form");
  if (!host || !centre) return;

  setHead("How was " + centre.name + "?", "Tell the operator what stood out.");
  v.removeAttribute("data-empty");

  host.innerHTML = centreFormHtml(centre);
  const card = host.querySelector("[data-centre-card]");
  card._rating = 0;
  syncCentreCount(card);
  syncCentrePost(card);
}

function syncCentreCount(card) {
  const ta = card.querySelector("[data-comment]");
  const out = card.querySelector("[data-count]");
  if (!ta || !out) return;
  const n = ta.value.length;
  out.textContent = n + "/" + CENTRE_COMMENT_MAX;
  out.classList.toggle("is-near", n >= CENTRE_COMMENT_MAX - 100);
}

function syncCentrePost(card) {
  const post = card.querySelector("[data-centre-post]");
  if (post) post.disabled = !card._rating;
}

async function postCentre(card) {
  const btn = card.querySelector("[data-centre-post]");
  const tag = card.querySelector("[data-facility]").value;
  const comment = card.querySelector("[data-comment]").value;

  showError(card, "");
  if (btn) { btn.disabled = true; btn.textContent = "Sending…"; }

  try {
    await submitCentreFeedback({
      hawkerId: centre.hawkerId,
      rating: card._rating || 0,
      facilityTag: tag,
      comment: comment,
    });
  } catch (err) {
    showError(card, err && err.message ? err.message : "Could not send your feedback.");
    if (btn) { btn.disabled = false; btn.textContent = "Send feedback"; }
    return;
  }

  showToast("Thanks — your feedback went to the operator.", "success");
  openCentres();
}

let paintedKey = null;

function paint(force) {
  const v = view();
  if (!v) return;
  v.dataset.mode = mode;
  const key = mode + ":" + (orderId || "") + ":" + (centre ? centre.hawkerId : "");
  if (!force && key === paintedKey) return;
  paintedKey = key;
  if (mode === "orders") return renderOrders();
  if (mode === "centres") return renderCentres();
  if (mode === "centre") return renderCentreForm();
  return renderCards();
}

/* ---------------- per-card state ---------------- */

function syncStars(card) {
  const rating = card._rating || 0;
  card.querySelectorAll(".rv-star").forEach(function (btn) {
    const i = Number(btn.dataset.star);
    btn.querySelector(".rv-star__icon").src = "../images/" + (i <= rating ? "star.svg" : "star-empty.svg");
    btn.setAttribute("aria-checked", String(i === rating));
    btn.classList.toggle("is-picked", i === rating);
  });
  card.querySelector("[data-word]").textContent = rating ? WORDS[rating - 1] : "";
}

function setStarsEnabled(card, enabled) {
  card.querySelectorAll(".rv-star").forEach(function (btn) {
    btn.disabled = !enabled;
    btn.setAttribute("aria-disabled", String(!enabled));
  });
}

function syncCount(card) {
  const ta = card.querySelector("[data-comment]");
  const out = card.querySelector("[data-count]");
  if (!ta || !out) return;
  const n = ta.value.length;
  out.textContent = n + "/" + COMMENT_MAX;
  out.classList.toggle("is-near", n >= COMMENT_MAX - 20);
}

// A rating is required (FeedbackRating is NOT NULL); a comment is not.
function syncPost(card) {
  const post = card.querySelector("[data-post]");
  if (post) post.disabled = !card._rating;
}

function showError(card, message) {
  const el = card.querySelector("[data-error]");
  if (!el) return;
  el.textContent = message || "";
  el.hidden = !message;
}

function markDone(card, comment, edited) {
  const rating = card._rating || 0;
  card.classList.remove("is-editing");
  card.classList.add("is-done");
  setStarsEnabled(card, false);
  card.querySelector("[data-done-text]").textContent =
    (edited ? "Edited · " : "Posted · ") + (rating ? WORDS[rating - 1] : "");
  const said = card.querySelector("[data-said]");
  said.textContent = comment ? "“" + comment + "”" : "";
  said.hidden = !comment;
  card.querySelector(".rv-acts").hidden = !card._feedbackId;
  card._saved = { rating: rating, comment: comment };
  showError(card, "");
  refreshSummary();
}

function markUndone(card) {
  card.classList.remove("is-done", "is-editing");
  card._feedbackId = null;
  card._rating = 0;
  card._saved = { rating: 0, comment: "" };
  card._edited = false;
  const ta = card.querySelector("[data-comment]");
  if (ta) ta.value = "";
  setStarsEnabled(card, true);
  syncStars(card);
  syncCount(card);
  syncPost(card);
  card.querySelector("[data-post]").textContent = "Post review";
  card.querySelector(".rv-acts").hidden = true;
  showError(card, "");
  refreshSummary();
}

/* ---------------- create / update / delete ---------------- */

function beginEdit(card) {
  card.classList.remove("is-done");
  card.classList.add("is-editing");
  card._rating = card._saved.rating;
  const ta = card.querySelector("[data-comment]");
  if (ta) ta.value = card._saved.comment;
  setStarsEnabled(card, true);
  syncStars(card);
  syncCount(card);
  syncPost(card);
  card.querySelector("[data-post]").textContent = "Save changes";
  showError(card, "");
  refreshSummary();
  if (ta) ta.focus();
}

function cancelEdit(card) {
  card._rating = card._saved.rating;
  const ta = card.querySelector("[data-comment]");
  if (ta) ta.value = card._saved.comment;
  syncStars(card);
  syncCount(card);
  markDone(card, card._saved.comment, card._edited);
}

async function post(card) {
  const btn = card.querySelector("[data-post]");
  const ta = card.querySelector("[data-comment]");
  if (!btn || btn.disabled) return;

  const editing = !!card._feedbackId;
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = editing ? "Saving…" : "Posting…";
  showError(card, "");

  const comment = ta ? ta.value.trim() : "";
  try {
    if (editing) {
      await updateReview(card._feedbackId, { rating: card._rating, comment: comment });
    } else {
      const body = await submitReview({
        orderId: orderId,
        stallId: card.dataset.stall,
        rating: card._rating,
        comment: comment,
      });
      card._feedbackId = body && body.data ? body.data.feedbackId : null;
    }
    btn.textContent = label;
    if (editing) card._edited = true;
    markDone(card, comment, card._edited);
  } catch (err) {
    btn.textContent = label;
    btn.disabled = false;
    showError(card, err && err.message ? err.message : "Could not save that review. Try again.");
  }
}

async function removeReview(card) {
  const name = card.querySelector(".rv-card__name").textContent;
  const ok = await showConfirm(
    "Delete this review?",
    "Your rating and comment for " + esc(name) + " will be removed. You can review this stall again for this order.",
    { confirmLabel: "Delete", destructive: true },
  );
  if (!ok) return;

  const del = card.querySelector("[data-delete]");
  if (del) { del.disabled = true; del.textContent = "Deleting…"; }
  showError(card, "");

  try {
    await deleteReview(card._feedbackId);
    markUndone(card);
  } catch (err) {
    showError(card, err && err.message ? err.message : "Could not delete that review. Try again.");
  } finally {
    if (del) { del.disabled = false; del.textContent = "Delete"; }
  }
}

/* ---------------- opening ---------------- */

async function open(id) {
  const next = id != null ? String(id) : null;
  orderId = next;
  centre = null;
  mode = next ? "order" : "orders";

  const state = { view: "reviews", rvOrder: next };
  if (doc.body.dataset.view !== "reviews") {
    history.pushState(state, "", "#reviews");
    const go = function () {
      if (typeof window.applyView === "function") window.applyView("reviews");
      else doc.body.dataset.view = "reviews";
    };
    if (doc.startViewTransition) doc.startViewTransition(go);
    else go();
  } else {
    history.pushState(state, "", "#reviews");
  }

  const v = view();
  if (v) v.scrollTop = 0;
  await paint(true);
}

/** Back to the order list from one order, without leaving the screen. */
function showOrders() {
  open(null);
}

function openCentres() {
  orderId = null;
  centre = null;
  mode = "centres";
  history.pushState({ view: "reviews", rvCentres: true }, "", "#reviews");
  const v = view();
  if (v) v.scrollTop = 0;
  return paint(true);
}

function openCentreForm(hawkerId, name) {
  orderId = null;
  centre = { hawkerId: hawkerId, name: name };
  mode = "centre";
  history.pushState({ view: "reviews", rvCentre: String(hawkerId) }, "", "#reviews");
  const v = view();
  if (v) v.scrollTop = 0;
  return paint(true);
}

function recordPlacedOrder(groups) {
  const items = [];
  (groups || []).forEach(function (g) {
    const ref = g.storeRef || {};
    (g.lines || []).forEach(function (l) {
      items.push({
        menu_id: null, // the bag holds a dish SNAPSHOT, not a menu id — see bag.js
        stall_id: ref.stallId != null ? ref.stallId : null,
        stall_name: g.store,
        centre_name: ref.location || "",
        stall_image: ref.img || null,
        item_name: l.dish ? l.dish.name : "",
        quantity: l.qty,
      });
    });
  });

  if (!items.some(function (i) { return i.stall_id != null; })) {
    orderId = null;
    return null;
  }

  // Minted here so the caller has the id synchronously, before recordOrder() resolves.
  const id = "local-" + Date.now();
  orderId = id;
  recordOrder({
    order_id: id,
    order_date: new Date().toISOString(),
    order_status: "completed",
    items: items,
  });
  return id;
}

function openAfterOrder() {
  if (!orderId) return false;
  open(orderId);
  return true;
}

window.hawkrReviews = {
  open: open,
  openOrders: showOrders,
  openAfterOrder: openAfterOrder,
  recordPlacedOrder: recordPlacedOrder,
};

/* ---------------- wiring ---------------- */

function init() {
  const v = view();
  if (!v) return;
  v.dataset.mode = mode;

  v.addEventListener("click", function (e) {
    if (e.target.closest("[data-rv-back]")) { history.back(); return; }

    if (e.target.closest("[data-menu]")) {
      const m = doc.querySelector('#view-home button[aria-label="Menu"], #view-store button[aria-label="Menu"]');
      if (m) m.click();
      return;
    }

    const cta = e.target.closest(".rv-empty__cta");
    if (cta) {
      const kind = cta.dataset.rvCta || "browse";
      if (kind === "signin") { window.location.href = "/auth/login.html"; }
      else if (kind === "retry") paint(true);
      else if (kind === "orders") showOrders();
      else if (typeof window.navigate === "function") window.navigate("home");
      return;
    }

    const row = e.target.closest("[data-order]");
    if (row) { open(row.dataset.order); return; }

    if (e.target.closest("[data-rv-centre-start]")) { openCentres(); return; }

    const centreRow = e.target.closest("[data-centre]");
    if (centreRow) {
      openCentreForm(Number(centreRow.dataset.centre), centreRow.dataset.centreName);
      return;
    }

    const centreCard = e.target.closest("[data-centre-card]");
    if (centreCard) {
      if (e.target.closest("[data-centre-cancel]")) { openCentres(); return; }

      const centreStar = e.target.closest(".rv-star");
      if (centreStar) {
        centreCard._rating = Number(centreStar.dataset.star);
        syncStars(centreCard);
        syncCentrePost(centreCard);
        showError(centreCard, "");
        return;
      }

      if (e.target.closest("[data-centre-post]")) postCentre(centreCard);
      return;
    }

    const card = e.target.closest(".rv-card");
    if (!card) return;

    if (e.target.closest("[data-edit]")) { beginEdit(card); return; }
    if (e.target.closest("[data-delete]")) { removeReview(card); return; }
    if (e.target.closest("[data-cancel]")) { cancelEdit(card); return; }

    if (card.classList.contains("is-done")) return;

    const star = e.target.closest(".rv-star");
    if (star) {
      card._rating = Number(star.dataset.star);
      syncStars(card);
      syncPost(card);
      showError(card, ""); // picking again clears "pick a rating"
      return;
    }

    if (e.target.closest("[data-post]")) post(card);
  });

  v.addEventListener("keydown", function (e) {
    const star = e.target.closest(".rv-star");
    if (!star) return;
    const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    const card = star.closest(".rv-card");
    if (!card || card.classList.contains("is-done")) return;
    e.preventDefault();
    const next = Math.min(RATING_MAX, Math.max(1, (card._rating || 0) + step));
    card._rating = next;
    syncStars(card);
    if (card.hasAttribute("data-centre-card")) syncCentrePost(card);
    else syncPost(card);
    card.querySelector('.rv-star[data-star="' + next + '"]').focus();
  });

  v.addEventListener("input", function (e) {
    const ta = e.target.closest("[data-comment]");
    if (!ta) return;
    const centreCard = ta.closest("[data-centre-card]");
    if (centreCard) syncCentreCount(centreCard);
    else syncCount(ta.closest(".rv-card"));
  });

  window.autoHideBar(v, v.querySelector(".rv-bar"), "rv-bar--hidden", { hideAfter: 64 });

  doc.addEventListener("click", function (e) {
    if (e.target.closest('[data-sidebar-stub="reviews"]')) open();
  });

  window.addEventListener("popstate", function (e) {
    const st = e.state || {};
    if (st.view !== "reviews") return;

    if (st.rvCentre != null) {
      const known = centre && String(centre.hawkerId) === String(st.rvCentre) ? centre.name : "";
      centre = { hawkerId: Number(st.rvCentre), name: known };
      mode = "centre";
      orderId = null;
      if (!known) { openCentres(); return; }
      paint(true);
      return;
    }
    if (st.rvCentres) {
      centre = null;
      orderId = null;
      mode = "centres";
      paint(true);
      return;
    }

    const next = st.rvOrder != null ? String(st.rvOrder) : null;
    orderId = next;
    centre = null;
    mode = next ? "order" : "orders";
    paint(true);
  });

  function sync() {
    if (doc.body.dataset.view !== "reviews") { paintedKey = null; return; }
    const bar = v.querySelector(".rv-bar");
    if (bar) bar.classList.remove("rv-bar--hidden"); // always arrive with the bar showing
    paint();
  }
  new MutationObserver(sync).observe(doc.body, { attributes: true, attributeFilter: ["data-view"] });
  sync();
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
else init();
