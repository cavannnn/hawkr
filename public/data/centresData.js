import { authHeaders } from "./session.js";

const ORIGIN = "";

/* ---------------------------------------------------------- my centres -- */

// GET `/api/tickets/centres/mine`
export async function getMyCentres() {
  return request("/api/tickets/centres/mine");
}

// GET `/api/tickets/centres`
export async function getAllCentres() {
  return request("/api/tickets/centres");
}

// PUT `/api/profile/centres`
export async function setMyCentres(hawkerIds) {
  return request("/api/profile/centres", {
    method: "PUT",
    body: JSON.stringify({ hawkerIds: hawkerIds.map(Number) }),
  });
}

/* -------------------------------------------------------------- closures -- */

// GET `/api/centre-management/closures?hawkerId=${hawkerId}`
export async function getClosures(hawkerId) {
  return request(`/api/centre-management/closures?hawkerId=${hawkerId}`);
}

// POST `/api/centre-management/closures`
export async function createClosure(closure) {
  return request("/api/centre-management/closures", {
    method: "POST",
    body: JSON.stringify(closure),
  });
}

/* Only an ACTIVE closure can be ended early — anything else is a 409, not a 400, because
   the request was well formed and the row was simply in the wrong state. LIVE. */
// PATCH `/api/centre-management/closures/${closureId}/end`
export async function endClosure(closureId) {
  return request(`/api/centre-management/closures/${closureId}/end`, { method: "PATCH" });
}

export async function cancelClosure(closureId) {
  return request(`/api/centre-management/closures/${closureId}/cancel`, { method: "PATCH" });
}

/* ------------------------------------------------------------- analytics -- */

// GET `/api/centre-management/analytics/${hawkerId}?period=${period}`
export async function getCentreAnalytics(hawkerId, period = "month") {
  return request(`/api/centre-management/analytics/${hawkerId}?period=${period}`);
}

/* ----------------------------------------------------------- satisfaction -- */

// GET `/api/centre-management/satisfaction/${hawkerId}`
export async function getCentreSatisfaction(hawkerId) {
  return request(`/api/centre-management/satisfaction/${hawkerId}`);
}

// GET `/api/centre-management/satisfaction/${hawkerId}/negative?source=${source}`
export async function getNegativeFeedback(hawkerId, source = "stall") {
  return request(`/api/centre-management/satisfaction/${hawkerId}/negative?source=${source}`);
}

/* -------------------------------------------------------------- promotions -- */

/* The stalls a centre-wide promotion may target — active stalls in this centre only, by
   name. A stall that has closed cannot be given a discount. LIVE. */
// GET `/api/centre-management/stalls?hawkerId=${hawkerId}`
export async function getCentreStalls(hawkerId) {
  return request(`/api/centre-management/stalls?hawkerId=${hawkerId}`);
}

// GET `/api/centre-management/promotions?hawkerId=${hawkerId}`
export async function getCentrePromotions(hawkerId) {
  return request(`/api/centre-management/promotions?hawkerId=${hawkerId}`);
}

// POST `/api/centre-management/promotions`
export async function createCentrePromotion(promotion) {
  return request("/api/centre-management/promotions", {
    method: "POST",
    body: JSON.stringify(promotion),
  });
}

// POST `/api/centre-management/promotions/${promotionId}/clone`
export async function cloneCentrePromotion(promotionId, targetHawkerId) {
  return request(`/api/centre-management/promotions/${promotionId}/clone`, {
    method: "POST",
    body: JSON.stringify({ targetHawkerId: Number(targetHawkerId) }),
  });
}

/* --------------------------------------------------------------- profile -- */

// GET `/api/profile`
export async function getMyProfile() {
  return request("/api/profile");
}

// PUT `/api/profile`
export async function updateMyProfile(updates) {
  return request("/api/profile", { method: "PUT", body: JSON.stringify(updates) });
}

// POST `/api/profile/change-password`
export async function changePassword(passwords) {
  return request("/api/profile/change-password", {
    method: "POST",
    body: JSON.stringify(passwords),
  });
}

// DELETE `/api/profile`
export async function deleteMyAccount() {
  return request("/api/profile", { method: "DELETE" });
}

// POST `/api/profile/photo`
export async function uploadMyPhoto(file) {
  const body = new FormData();
  body.append("photo", file);

  const { "Content-Type": _json, ...headers } = authHeaders();
  const res = await fetch(ORIGIN + "/api/profile/photo", { method: "POST", headers, body });

  if (!res.ok) {
    let message = "";
    try {
      message = (await res.json()).error || "";
    } catch {
    }
    throw new Error(message || `${res.status} ${res.statusText} on /api/profile/photo`);
  }

  return res.json();
}

/* -------------------------------------------------------------------- helper -- */

async function request(path, options = {}) {
  const res = await fetch(ORIGIN + path, { headers: authHeaders(), ...options });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
  return res.json();
}
