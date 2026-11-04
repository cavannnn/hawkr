/* shared.js — data both roles read. */
import { authHeaders, getSession, getRole } from "./session.js";

const ORIGIN = "";

/* ---------------------------------------------------------------- food stalls -- */

// GET `/customer/stalls/${stallId}`
export async function getStallById(stallId) {
  return {
    id: String(stallId),
    stallName: "Northern Thai",
    unitNumber: "#01-32",
    cuisineType: "Thai",
    description: "Northern Thai staples, cooked to order.",
    contactNumber: "91234567",
    isHalal: false,
    isActive: true,
    isOpen: true,
    hawkerCentreId: "1",
    currentGrade: "A",
  };
}

export async function getStallsByHawkerCentre(hawkerCentreId) {
  return [
    { id: "1", stallName: "Northern Thai", unitNumber: "#01-32", cuisineType: "Thai", isOpen: true, isActive: true, currentGrade: "A", hawkerCentreId: String(hawkerCentreId) },
    { id: "2", stallName: "Redhill Prawn Noodle", unitNumber: "#01-14", cuisineType: "Chinese", isOpen: true, isActive: true, currentGrade: "B", hawkerCentreId: String(hawkerCentreId) },
    { id: "3", stallName: "Seoul Kitchen", unitNumber: "#02-07", cuisineType: "Korean", isOpen: false, isActive: true, currentGrade: "C", hawkerCentreId: String(hawkerCentreId) },
  ];
}

export async function getMyStalls(vendorId) {
  return {
    stalls: [
      { stallId: 1, stallName: "Northern Thai", unitNumber: "#01-32", operatingHours: "10:00 AM - 8:00 PM", neaGrade: "A", pendingGrade: null, imageUrl: null, centreId: 1, centreName: "Maxwell Food Centre", address: "1 Kadayanallur St" },
      { stallId: 2, stallName: "Northern Thai Express", unitNumber: "#02-11", operatingHours: "8:00 AM - 3:00 PM", neaGrade: "NEW", pendingGrade: "B", imageUrl: null, centreId: 2, centreName: "Chinatown Complex", address: "335 Smith St" },
    ],
    requests: [
      { requestId: 5, stallName: "Northern Thai Kopitiam", unitNumber: "#01-07", description: "Third outlet", status: "pending", operatingHours: "7:00 AM - 2:00 PM", hygieneGrade: null, imageUrl: null, reviewNote: null, requestedAt: "2026-07-20T09:00:00", centreName: "Amoy Street Food Centre" },
    ],
  };
}

/* ------------------------------------------------------- applying for a stall -- */

function me() {
  const user = getSession();
  if (!user) throw new Error("Not signed in.");
  return user.uid;
}

export async function getStallRequestCentres() {
  return request(`/vendor/${encodeURIComponent(me())}/centres`);
}

export const STALL_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const STALL_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const STALL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const HYGIENE_GRADES = ["A", "B"];

export function checkStallRequest({
  centreId, stallName, unitNumber, openingTime, closingTime, hygieneGrade, image,
} = {}) {
  if (!centreId) return "Choose the hawker centre this stall is in.";
  if (!String(stallName || "").trim()) return "Give the stall a name.";
  if (!String(unitNumber || "").trim()) return "Enter the unit number.";
  if (!openingTime || !closingTime) return "Enter when the stall opens and closes.";
  if (!image) return "Add a photo of the stall.";
  if (!STALL_IMAGE_TYPES.includes(image.type)) {
    return `${image.name} is not a supported image. Use a JPG, PNG, WEBP or GIF.`;
  }
  if (image.size > STALL_IMAGE_MAX_BYTES) {
    return `${image.name} is too large. The photo has to be under 5MB.`;
  }
  if (hygieneGrade && !HYGIENE_GRADES.includes(hygieneGrade)) {
    return "Declared grade has to be A or B, or left blank if not yet graded.";
  }
  return null;
}

function to12Hour(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  if (!match) return String(value || "").trim();
  const hours = Number(match[1]);
  if (hours > 23) return String(value).trim();
  const meridiem = hours < 12 ? "AM" : "PM";
  const shown = hours % 12 === 0 ? 12 : hours % 12;
  return `${shown}:${match[2]} ${meridiem}`;
}

// POST `/vendor/${vendorId}/stall-requests`
export async function createStall({
  centreId, stallName, unitNumber, description, openingTime, closingTime, hygieneGrade, image,
} = {}) {
  const problem = checkStallRequest({
    centreId, stallName, unitNumber, openingTime, closingTime, hygieneGrade, image,
  });
  if (problem) throw new Error(problem);

  const form = new FormData();
  form.append("centreId", String(centreId));
  form.append("stallName", String(stallName).trim());
  form.append("unitNumber", String(unitNumber).trim());
  form.append("openingTime", to12Hour(openingTime));
  form.append("closingTime", to12Hour(closingTime));
  if (String(description || "").trim()) form.append("description", String(description).trim());
  if (hygieneGrade) form.append("hygieneGrade", hygieneGrade);
  form.append("stallImage", image);

  const session = getSession();
  const res = await fetch(`/vendor/${encodeURIComponent(me())}/stall-requests`, {
    method: "POST",
    headers: session ? { Authorization: "Bearer " + session.token } : {},
    body: form,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    /* nothing to read; the status below is still true */
  }

  if (!res.ok) {
    const err = new Error(
      (body && body.message) || `Your application could not be sent (${res.status}).`,
    );
    err.status = res.status;
    throw err;
  }
  return body;
}

export async function updateStall(stallId, updates) {
  return { id: String(stallId), ...updates };
}

export async function setStallOpenStatus(stallId, isOpen) {
  return { id: String(stallId), isOpen };
}

/* ------------------------------------------------------------- hawker centres -- */

// GET `/customer/hawkers/${centreId}`
export async function getHawkerCentreById(centreId) {
  return {
    id: String(centreId),
    centreName: "Maxwell Food Centre",
    address: "1 Kadayanallur St",
    postalCode: "069184",
    operatingHours: "8:00am - 10:00pm",
    isActive: true,
  };
}

// GET `/customer/hawkers`
export async function getHawkerCentres() {
  return [
    { id: "1", centreName: "Maxwell Food Centre", address: "1 Kadayanallur St", postalCode: "069184", isActive: true },
    { id: "2", centreName: "Chinatown Complex", address: "335 Smith St", postalCode: "050335", isActive: true },
    { id: "3", centreName: "Amoy Street Food Centre", address: "7 Maxwell Rd", postalCode: "069111", isActive: true },
  ];
}

/* --------------------------------------------------------------- searching -- */

export async function getSearchableItems(scope) {
  const centres = await getHawkerCentres();
  const allStalls = await getAllStalls();
  const allMenuItems = await getSearchableMenuItems();

  const centreId = scope?.hawkerCentreId != null ? String(scope.hawkerCentreId) : null;

  const stalls = centreId
    ? allStalls.filter((s) => String(s.hawkerCentreId) === centreId)
    : allStalls;
  const stallIds = new Set(stalls.map((s) => String(s.id)));
  const menuItems = centreId
    ? allMenuItems.filter((m) => stallIds.has(String(m.stallId)))
    : allMenuItems;

  return [
    ...(centreId ? [] : centres).map((c) => ({
      id: c.id, type: "hawkerCentre", name: c.centreName,
      searchCount: c.searchCount || 0, image: c.imageUrl || "",
    })),
    ...stalls.map((s) => ({
      id: s.id, type: "stall", name: s.stallName,
      parentName: centres.find((c) => c.id === s.hawkerCentreId)?.centreName || "",
      hawkerCentreId: s.hawkerCentreId, searchCount: s.searchCount || 0,
      image: s.imageUrl || "",
    })),
    ...menuItems.map((m) => ({
      id: m.id, type: "menuItem", name: m.itemName,
      stallName: stalls.find((s) => s.id === m.stallId)?.stallName || "",
      stallId: m.stallId, price: m.price, category: m.category || "",
      image: m.imageUrl || "",
      keywords: [m.itemName, m.category, m.description].filter(Boolean).join(" ").toLowerCase(),
    })),
  ];
}

// GET `/customer/stalls`
export async function getAllStalls() {
  return [
    { id: "1", stallName: "Northern Thai", unitNumber: "#01-32", cuisineType: "Thai", hawkerCentreId: "1", isOpen: true, currentGrade: "A" },
    { id: "2", stallName: "Redhill Prawn Noodle", unitNumber: "#01-14", cuisineType: "Chinese", hawkerCentreId: "1", isOpen: true, currentGrade: "B" },
    { id: "3", stallName: "Seoul Kitchen", unitNumber: "#02-07", cuisineType: "Korean", hawkerCentreId: "2", isOpen: false, currentGrade: "C" },
  ];
}

export async function getSearchableMenuItems() {
  return [
    { id: "1", stallId: "1", itemName: "Pad Kra Pao", price: 6.5, category: "Mains", description: "Holy basil stir-fry" },
    { id: "2", stallId: "1", itemName: "Thai Iced Tea", price: 2.95, category: "Drinks", description: "" },
    { id: "3", stallId: "2", itemName: "Prawn Noodle Soup", price: 7.0, category: "Mains", description: "" },
  ];
}

/**
 * Bump a result's search counter, which is what ranks "popular searches".
 * Fire-and-forget: it must never block or fail navigation.
 */
// NO ENDPOINT YET — nothing records a search hit. Keep it fire-and-forget when it exists.
export async function recordSearchHit(type, id) {
  return { type, id, recorded: true };
}

/* ------------------------------------------------------------ notifications -- */

function toNotification(row) {
  return {
    id: String(row.notificationId),
    notificationId: row.notificationId,
    type: row.type,
    title: row.title,
    message: row.message || "",
    linkUrl: row.linkUrl || null,
    isRead: !!row.isRead,
    createdAt: row.createdAt,
  };
}

let inFlight = null;

async function fetchNotifications() {
  const user = getSession();
  if (!user || getRole() !== "vendor") return { notifications: [], unreadCount: 0 };
  if (inFlight) return inFlight;

  inFlight = request(`/vendor/${encodeURIComponent(user.uid)}/notifications`)
    .then((body) => ({
      notifications: (body.notifications || []).map(toNotification),
      unreadCount: Number(body.unreadCount) || 0,
    }))
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

// GET `/vendor/${vendorId}/notifications`
export async function getNotifications() {
  return (await fetchNotifications()).notifications;
}

export async function getUnreadNotificationCount() {
  return (await fetchNotifications()).unreadCount;
}

// PUT `/vendor/${vendorId}/notifications/${notificationId}/read`
export async function markNotificationRead(notificationId) {
  const user = getSession();
  if (!user) throw new Error("Not signed in.");
  return request(
    `/vendor/${encodeURIComponent(user.uid)}/notifications/${encodeURIComponent(notificationId)}/read`,
    { method: "PUT" },
  );
}

/* ------------------------------------------------------------------ utility -- */

export function formatTimeAgo(value) {
  const then = value?.toDate?.() ?? new Date(value);
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 60) return "just now";
  const units = [
    ["year", 31536000], ["month", 2592000], ["week", 604800],
    ["day", 86400], ["hour", 3600], ["minute", 60],
  ];
  for (const [name, secs] of units) {
    const n = Math.floor(seconds / secs);
    if (n >= 1) return `${n} ${name}${n > 1 ? "s" : ""} ago`;
  }
  return "just now";
}

/* -------------------------------------------------------------------- helper -- */

export async function request(path, options = {}) {
  const res = await fetch(ORIGIN + path, { headers: authHeaders(), ...options });

  if (!res.ok) {
    let message = "";
    try {
      const body = await res.json();
      message = body?.message || body?.error || "";
    } catch {
    }
    const err = new Error(message || `${res.status} ${res.statusText} on ${path}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}
