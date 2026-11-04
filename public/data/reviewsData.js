import { authHeaders, getSession } from "./session.js";

const ORIGIN = "";

export const COMMENT_MAX = 150;

export const RATING_MIN = 1;
export const RATING_MAX = 5;

/* ------------------------------------------------------- which ids are real -- */

export function isLocalOrderId(orderId) {
  return !/^\d+$/.test(String(orderId == null ? "" : orderId).trim());
}

/* ------------------------------------------------- the local order record -- */

const STORE_KEY = "hawkr:reviews";
const STORE_VERSION = 1;

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { v: STORE_VERSION, orders: {} };
    const s = JSON.parse(raw);
    // Shape changed → discard wholesale rather than guess, same as bag.js's load().
    if (!s || s.v !== STORE_VERSION) return { v: STORE_VERSION, orders: {} };
    if (s.reviews) writeStore({ v: STORE_VERSION, orders: s.orders || {} });
    return { v: STORE_VERSION, orders: s.orders || {} };
  } catch (e) {
    return { v: STORE_VERSION, orders: {} };
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ v: STORE_VERSION, orders: store.orders || {} }));
  } catch (e) {
  }
}

/* --------------------------------------------------------------- the order -- */

export async function getMyOrders() {
  if (!getSession()) return []; // no token, no orders — the route is behind verifyToken
  const body = await request("/api/orders");
  return (body && body.data) || [];
}

export async function getOrder(orderId) {
  if (isLocalOrderId(orderId)) {
    return readStore().orders[String(orderId)] || null;
  }
  const body = await request(`/api/orders/${encodeURIComponent(orderId)}`);
  return (body && body.data) || null;
}

export function stallsInOrder(order) {
  const groups = [];
  const byStall = {};

  (order?.items || []).forEach((line) => {
    if (line.stall_id == null) return; // unresolvable stall — see the note above
    const key = String(line.stall_id);
    let group = byStall[key];
    if (!group) {
      group = byStall[key] = {
        stallId: line.stall_id,
        stallName: line.stall_name || "This stall",
        centreName: line.centre_name || "",
        image: line.stall_image || null,
        items: [],
      };
      groups.push(group);
    }
    group.items.push({
      itemName: line.item_name,
      quantity: line.quantity,
    });
  });

  return groups;
}

/* ---------------------------------------------------------- order history -- */

export async function getOrderHistory() {
  const rows = await getMyOrders();

  return rows
    .map((r) => ({
      orderId: String(r.order_id),
      placedAt: r.order_date || null,
      status: r.order_status || "",
      stallName: r.stall_name || "",
      centreName: r.hawker_name || "",
      itemCount: Number(r.item_count) || 0,
      total: r.total_amount == null ? null : Number(r.total_amount),
    }))
    .sort((a, b) => new Date(b.placedAt || 0) - new Date(a.placedAt || 0));
}

/* -------------------------------------------------------------- the reviews -- */

export async function getMyReviewsForOrder(orderId) {
  if (!getSession() || isLocalOrderId(orderId)) return [];
  const body = await request(`/api/feedback/order/${encodeURIComponent(orderId)}`);
  return (body && body.data) || [];
}

export async function getReviewedStalls(orderId) {
  return (await getMyReviewsForOrder(orderId)).map((r) => String(r.StallId));
}

export async function getReviewPrompt(orderId) {
  const [order, mine] = await Promise.all([
    getOrder(orderId),
    getMyReviewsForOrder(orderId),
  ]);
  if (!order) return [];

  return stallsInOrder(order).map((group) => {
    const existing = mine.find((r) => String(r.StallId) === String(group.stallId));
    return {
      ...group,
      orderId: String(orderId),
      reviewed: !!existing,
      feedbackId: existing ? existing.FeedbackId : null,
      rating: existing ? Number(existing.FeedbackRating) : 0,
      comment: existing && existing.FeedbackComment ? existing.FeedbackComment : "",
      edited: !!(existing && existing.FeedbackUpdatedAt),
    };
  });
}

function checkReview(rating, comment) {
  const clean = String(comment == null ? "" : comment).trim();
  if (!(Number.isInteger(Number(rating)) && rating >= RATING_MIN && rating <= RATING_MAX)) {
    throw new Error(`Pick a rating from ${RATING_MIN} to ${RATING_MAX} stars.`);
  }
  if (clean.length > COMMENT_MAX) {
    throw new Error(`A comment cannot be longer than ${COMMENT_MAX} characters.`);
  }
  return clean;
}

export async function submitReview({ orderId, stallId, rating, comment }) {
  if (!orderId) throw new Error("A review has to belong to an order.");
  if (!stallId) throw new Error("A review has to name a stall.");
  const clean = checkReview(rating, comment);

  return request("/api/feedback", {
    method: "POST",
    body: JSON.stringify({ orderId, stallId, rating, comment: clean || null }),
  });
}

export async function updateReview(feedbackId, { rating, comment }) {
  if (!feedbackId) throw new Error("There is no review here to change.");
  const clean = checkReview(rating, comment);

  return request(`/api/feedback/${encodeURIComponent(feedbackId)}`, {
    method: "PUT",
    body: JSON.stringify({ rating, comment: clean || null }),
  });
}

export async function deleteReview(feedbackId) {
  if (!feedbackId) throw new Error("There is no review here to remove.");
  return request(`/api/feedback/${encodeURIComponent(feedbackId)}`, { method: "DELETE" });
}

export async function getStallReviews(stallId) {
  const body = await request(`/api/feedback/stall/${encodeURIComponent(stallId)}`);
  return (body && body.data) || [];
}

export const CENTRE_COMMENT_MAX = 1000;

export const FACILITY_TAGS = ["Cleanliness", "Seating", "Toilets", "Ventilation", "Queue", "Other"];

export async function getCentresForFeedback() {
  if (!getSession()) return [];
  const rows = await request("/api/tickets/centres");
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({ hawkerId: r.HawkerId, name: r.Name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getMyCentreFeedback() {
  if (!getSession()) return [];
  const body = await request("/api/hawkers/feedback/mine");
  return ((body && body.data) || []).map((r) => ({
    feedbackId: r.feedback_id,
    hawkerId: r.hawker_id,
    hawkerName: r.hawker_name,
    rating: Number(r.rating),
    facilityTag: r.facility_tag,
    comment: r.comment || "",
    createdAt: r.created_at || null,
  }));
}

export async function submitCentreFeedback({ hawkerId, rating, facilityTag, comment }) {
  if (!hawkerId) throw new Error("Pick a hawker centre first.");
  if (!(Number.isInteger(Number(rating)) && rating >= RATING_MIN && rating <= RATING_MAX)) {
    throw new Error(`Pick a rating from ${RATING_MIN} to ${RATING_MAX} stars.`);
  }
  if (!FACILITY_TAGS.includes(facilityTag)) {
    throw new Error("Pick what your feedback is about.");
  }
  const clean = String(comment == null ? "" : comment).trim();
  if (clean.length > CENTRE_COMMENT_MAX) {
    throw new Error(`A comment cannot be longer than ${CENTRE_COMMENT_MAX} characters.`);
  }

  return request(`/api/hawkers/${encodeURIComponent(hawkerId)}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating: Number(rating), facility_tag: facilityTag, comment: clean || null }),
  });
}

/* ------------------------------------------------------- checkout hand-off -- */

export async function recordOrder(order) {
  const store = readStore();
  const orderId = String(order?.order_id || "local-" + (Object.keys(store.orders).length + 1));
  store.orders[orderId] = { ...order, order_id: orderId };
  writeStore(store);
  return orderId;
}

export async function getLatestOrderId() {
  const ids = Object.keys(readStore().orders);
  return ids.length ? ids[ids.length - 1] : null;
}

/* -------------------------------------------------------------------- helper -- */

export async function request(path, options = {}) {
  const res = await fetch(ORIGIN + path, { headers: authHeaders(), ...options });

  let body = null;
  try {
    body = await res.json();
  } catch (e) {
  }

  if (!res.ok) {
    const err = new Error((body && body.message) || `Request failed (${res.status}).`);
    err.status = res.status;
    throw err;
  }
  return body;
}
