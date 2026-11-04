import { authHeaders } from "./session.js";

const ORIGIN = "";

/* -------------------------------------------------------------------- helper -- */

async function request(path, options = {}) {
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

function unwrap(body) {
  if (!Array.isArray(body?.data)) {
    throw new Error("The server's answer was not in the shape this screen expects.");
  }
  return body.data;
}

/* ------------------------------------------------------------------ operator -- */

export async function getOperator(operatorId) {
  return {
    id: String(operatorId),
    name: "Singapore Food Agency",
    email: "operator@example.com",
    contactNumber: "62223333",
    hawkerCentreId: "1",
    onboardingComplete: true,
  };
}

export async function updateOperator(operatorId, updates) {
  return { id: String(operatorId), ...updates };
}

/* ------------------------------------------------------------ hawker centres -- */

// GET `/api/tickets/centres/mine`
export async function getHawkerCentresByOperator(operatorId) {
  const centres = await request("/api/tickets/centres/mine");
  return centres.map((centre) => ({
    id: String(centre.HawkerId),
    centreName: centre.Name,
  }));
}

export async function getHawkerCentreStats(centreId) {
  return {
    centreId: String(centreId),
    totalStalls: 3,
    activeStalls: 2,
    occupancyRate: 0.67,
    monthlyRevenue: 18420.5,
    outstandingRent: 2400.0,
    averageGrade: "B",
  };
}

export async function findOrCreateHawkerCentre(centreName, details = {}) {
  return { id: "1", centreName, address: details.address || "", postalCode: details.postalCode || "", isActive: true };
}

/* ------------------------------------------------- children (stalls + vendors) -- */

// A: GET `/api/centre-management/stalls?hawkerId=`  ->  [ { StallId, StallName } ]
// B: GET `/api/stalls?hawker_id=`                   ->  { success, data: [ ...stall rows ] }
// C: GET `/stalls`                                  ->  [ { stallId, unitNumber, currentGrade, centreName } ]
export async function getChildStalls(centreId) {
  const id = String(centreId);

  const scoped = await request(
    `/api/centre-management/stalls?hawkerId=${encodeURIComponent(id)}`,
  );
  if (!Array.isArray(scoped)) {
    throw new Error("The server's answer was not in the shape this screen expects.");
  }
  if (scoped.length === 0) return [];

  const [detail, graded] = await Promise.all([
    request(`/api/stalls?hawker_id=${encodeURIComponent(id)}`)
      .then(unwrap)
      .catch((error) => {
        console.error("Could not read this centre's stall details:", error);
        return null;
      }),
    request("/stalls").catch((error) => {
      console.error("Could not read hygiene grades:", error);
      return null;
    }),
  ]);

  const detailById = new Map(
    (Array.isArray(detail) ? detail : []).map((row) => [String(row.stall_id), row]),
  );
  const gradeById = new Map(
    (Array.isArray(graded) ? graded : []).map((row) => [String(row.stallId), row]),
  );

  return scoped.map((row) => {
    const stallId = String(row.StallId);
    const facts = detailById.get(stallId);
    const grade = gradeById.get(stallId);

    return {
      id: stallId,
      stallName: row.StallName,
      unitNumber: (facts && facts.stall_number) || (grade && grade.unitNumber) || null,
      cuisineType: (facts && facts.cuisine_type) || null,
      description: (facts && facts.description) || null,
      currentGrade: (grade && grade.currentGrade) || null,
      centreName: (facts && facts.hawker_name) || (grade && grade.centreName) || null,
      hawkerCentreId: id,
      /* Asserted, not assumed: both A and B filter to isActive = 1 server-side. */
      isActive: true,
      detailsUnavailable: facts === undefined,
    };
  });
}

export async function getVendorsByHawkerCentre(centreId) {
  return [
    { id: "1", businessName: "Northern Thai",        uen: "53498765X", stallId: "1", unitNumber: "#01-32", status: "active",   hawkerCentreId: String(centreId) },
    { id: "2", businessName: "Redhill Prawn Noodle", uen: "53411122Y", stallId: "2", unitNumber: "#01-14", status: "active",   hawkerCentreId: String(centreId) },
    { id: "3", businessName: "Seoul Kitchen",        uen: "53433344Z", stallId: "3", unitNumber: "#02-07", status: "inactive", hawkerCentreId: String(centreId) },
  ];
}

/* --------------------------------------------------- one child, in detail -- */

// GET `/api/orders?stall_id=${stallId}`
export async function getStallOrders(stallId) {
  return [
    { order_id: 1, stall_id: Number(stallId), hawker_id: 1, customer_name: "Wei Ling", order_date: "2026-07-28T12:04:00", order_status: "completed", total_amount: 12.4, payment_method: "paynow", payment_status: "paid", stall_name: "Northern Thai", hawker_name: "Maxwell Food Centre", item_count: 2, items: [] },
    { order_id: 2, stall_id: Number(stallId), hawker_id: 1, customer_name: "Marcus", order_date: "2026-07-29T18:41:00", order_status: "ready", total_amount: 6.5, payment_method: "card", payment_status: "paid", stall_name: "Northern Thai", hawker_name: "Maxwell Food Centre", item_count: 1, items: [] },
    { order_id: 3, stall_id: Number(stallId), hawker_id: 1, customer_name: "Priya", order_date: "2026-07-30T11:15:00", order_status: "pending", total_amount: 9.0, payment_method: "cash", payment_status: "unpaid", stall_name: "Northern Thai", hawker_name: "Maxwell Food Centre", item_count: 1, items: [] },
  ];
}

// GET `/api/menu/stall/${stallId}`
export async function getStallMenuLikes(stallId) {
  const menu = unwrap(await request(`/api/menu/stall/${encodeURIComponent(stallId)}`));
  return menu.map((item) => ({ ...item, likesCount: 0 }));
}

// GET `/stalls/${stallId}/grade-history`
export async function getStallGradeHistory(stallId) {
  return request(`/stalls/${encodeURIComponent(stallId)}/grade-history`);
}

export async function unlinkStallFromVendor(stallId) {
  return { stallId: String(stallId), unlinked: true };
}

/* -------------------------------------------------------------- transactions -- */

export async function getOperatorTransactions(hawkerCentreId) {
  return [
    { id: "1", hawkerCentreId: String(hawkerCentreId), stallId: "1", vendorName: "Northern Thai",        type: "rent",    amount: 1200.0, status: "paid",      createdAt: "2026-07-01T09:00:00", reference: "RENT-2607-01" },
    { id: "2", hawkerCentreId: String(hawkerCentreId), stallId: "2", vendorName: "Redhill Prawn Noodle", type: "rent",    amount: 1200.0, status: "paid",      createdAt: "2026-07-01T09:00:00", reference: "RENT-2607-02" },
    { id: "3", hawkerCentreId: String(hawkerCentreId), stallId: "3", vendorName: "Seoul Kitchen",        type: "rent",    amount: 1200.0, status: "overdue",   createdAt: "2026-07-01T09:00:00", reference: "RENT-2607-03" },
    { id: "4", hawkerCentreId: String(hawkerCentreId), stallId: "1", vendorName: "Northern Thai",        type: "utility", amount: 180.5,  status: "pending",   createdAt: "2026-07-15T09:00:00", reference: "UTIL-2607-01" },
  ];
}

/* ------------------------------------------------------------ stall requests -- */

/* ----------------------------------------------------------------- feedback -- */

// GET `/api/feedback/stall/${stallId}`
export async function getStallFeedback(stallId) {
  return unwrap(await request(`/api/feedback/stall/${encodeURIComponent(stallId)}`));
}

// PUT `/api/feedback/${feedbackId}/response`
export async function resolveFeedbackWithResponse(feedbackId, response) {
  return { FeedbackId: feedbackId, response, resolvedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------ notifications -- */

export async function subscribeToOperatorNotifications(operatorId, callback) {
  const notifications = [
    { id: "1", title: "Rent overdue",   body: "Seoul Kitchen is 12 days overdue", isRead: false, createdAt: "2026-07-13T09:00:00" },
    { id: "2", title: "New stall request", body: "A vendor applied for #02-11",   isRead: true,  createdAt: "2026-07-10T14:22:00" },
  ];
  callback(notifications);
  return () => {};
}

export async function markOperatorNotificationAsRead(notificationId) {
  return { id: String(notificationId), isRead: true };
}

export { formatTimeAgo } from "./shared.js";

export {
  getStallById, getStallsByHawkerCentre, getMyStalls, updateStall, setStallOpenStatus,
  getHawkerCentreById, getHawkerCentres,
} from "./shared.js";
