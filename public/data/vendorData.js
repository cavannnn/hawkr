import { authHeaders, getSession } from "./session.js";

import { request, getNotifications, markNotificationRead } from "./shared.js";

/* -------------------------------------------------------------------- vendor -- */

export async function getVendor(vendorId) {
  return {
    id: String(vendorId),
    businessName: "Northern Thai",
    uen: "53498765X",
    email: "vendor@example.com",
    contactNumber: "91234567",
    hawkerCentreId: "1",
    onboardingComplete: true,
    status: "active",
  };
}

export async function updateVendor(vendorId, updates) {
  return { id: String(vendorId), ...updates };
}

/* ------------------------------------------------------- vendor settings -- */

export async function updateVendorBusinessProfile(vendorId, details) {
  return { id: String(vendorId), ...details, persisted: false };
}

export async function setVendorTelegramLink(vendorId, telegram) {
  return { id: String(vendorId), telegram, persisted: false };
}

export async function setVendorNotificationPreference(vendorId, enabled) {
  return { id: String(vendorId), browserNotifications: enabled, persisted: false };
}

export async function uploadVendorDocument(vendorId, documentKey, file) {
  return { id: String(vendorId), documentKey, url: null, persisted: false };
}

export async function deleteVendorDocument(vendorId, documentKey) {
  return { id: String(vendorId), documentKey, url: null, persisted: false };
}

/* ------------------------------------------------------------------- search -- */

export async function searchVendor(query) {
  const q = (query || "").trim();
  if (q.length < 2) return [];

  const { results } = await request(
    `/vendor/${vendorId()}/search?q=${encodeURIComponent(q)}`,
  );
  return (results || []).map(toSearchResultItem);
}

const SEARCH_RESULT_LOOKS = {
  "Stall": { icon: "/assets/icons/vendor.svg", color: "#EAF5E9" },
  "Menu Item": { icon: "/assets/icons/menu.svg", color: "#F2F2FF" },
  "Stock Item": { icon: "/assets/icons/clipboard.svg", color: "#EAF5E9" },
  "Promotion": { icon: "/assets/icons/vouchers.svg", color: "#F6EEF9" },
  "Voucher": { icon: "/assets/icons/vouchers.svg", color: "#F6EEF9" },
  "Order": { icon: "/assets/icons/orders.svg", color: "#F6EEF9" },
};

function escapeText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toSearchResultItem(row) {
  const look = SEARCH_RESULT_LOOKS[row.type] || {};
  return {
    id: row.id,
    type: row.type,
    name: escapeText(row.label),
    subtitle: row.sublabel
      ? `${escapeText(row.type)} • ${escapeText(row.sublabel)}`
      : escapeText(row.type),
    url: escapeText(row.url),
    icon: look.icon,
    color: look.color,
  };
}

/* ------------------------------------------------------------------ tenancy -- */

export async function disconnectStallFromOperator(stallId) {
  return { stallId: Number(stallId), disconnected: false, persisted: false };
}

/* --------------------------------------------------------------------- menu -- */

function vendorId() {
  const user = getSession();
  if (!user) throw new Error("Not signed in — no vendor id for the menu call.");
  return user.uid;
}

export async function getStallMenu(stallId) {
  vendorId(); // goes in the path when this is wired; called here so a signed-out read fails the same way
  return [
    { menuId: 1, itemName: "Pad Kra Pao",   price: 6.5,  category: "Rice",   description: "Holy basil stir-fry, fried egg on top", available: 1 },
    { menuId: 2, itemName: "Thai Iced Tea", price: 2.95, category: "Drinks", description: "",                                      available: 1 },
    { menuId: 3, itemName: "Green Curry",   price: 9.45, category: "Rice",   description: "Chicken, bamboo shoots, thai basil",    available: 0 },
  ];
}

export async function addMenuItem(stallId, item) {
  vendorId();
  return { message: "Menu item added." };
}

export async function updateMenuItem(stallId, menuId, updates) {
  vendorId();
  return { message: "Menu item updated." };
}

// DELETE `/vendor/${vendorId}/stalls/${stallId}/menu/${menuId}`
export async function deleteMenuItem(stallId, menuId) {
  vendorId();
  return { message: "Menu item deleted." };
}

export async function getStallTopItems(stallId) {
  vendorId();
  return [
    { itemName: "Pad Kra Pao", totalQuantity: 128 },
    { itemName: "Green Curry", totalQuantity: 74 },
    { itemName: "Thai Iced Tea", totalQuantity: 61 },
  ];
}

export async function getStallMenuFavouriteCounts(stallId) {
  return [];
}

/* ------------------------------------------------------------------- orders -- */

export async function getStallOrders(stallId, status = null) {
  const all = [
    { order_id: 1001, hawker_id: 1, stall_id: Number(stallId), stall_name: "Northern Thai", hawker_name: "Maxwell Food Centre", customer_name: "Wei Ling", customer_phone: "98765432", order_date: "2026-07-26T11:02:00", order_status: "pending",   total_amount: 12.4, payment_method: "paynow", payment_status: "paid",     item_count: 2 },
    { order_id: 1002, hawker_id: 1, stall_id: Number(stallId), stall_name: "Northern Thai", hawker_name: "Maxwell Food Centre", customer_name: "Marcus",   customer_phone: "91112222", order_date: "2026-07-26T11:14:00", order_status: "preparing", total_amount: 6.5,  payment_method: "card",   payment_status: "paid",     item_count: 1 },
    { order_id: 1003, hawker_id: 1, stall_id: Number(stallId), stall_name: "Northern Thai", hawker_name: "Maxwell Food Centre", customer_name: "Siti",     customer_phone: "93334444", order_date: "2026-07-25T18:40:00", order_status: "completed", total_amount: 9.45, payment_method: "cash",   payment_status: "paid",     item_count: 1 },
    { order_id: 1004, hawker_id: 1, stall_id: Number(stallId), stall_name: "Northern Thai", hawker_name: "Maxwell Food Centre", customer_name: "Wei Ling", customer_phone: "98765432", order_date: "2026-07-24T12:05:00", order_status: "completed", total_amount: 6.5,  payment_method: "paynow", payment_status: "refunded", item_count: 1 },
  ];
  return status ? all.filter((o) => o.order_status === status) : all;
}

export async function getOrderById(orderId) {
  return {
    order_id: Number(orderId), hawker_id: 1, stall_id: 1,
    stall_name: "Northern Thai", hawker_name: "Maxwell Food Centre",
    customer_name: "Wei Ling", customer_phone: "98765432",
    order_date: "2026-07-26T11:02:00", order_status: "pending",
    total_amount: 12.4, payment_method: "paynow", payment_status: "paid",
    special_instructions: null,
    items: [
      { order_item_id: 1, menu_id: 1, stall_id: 1, stall_name: "Northern Thai", item_name: "Pad Kra Pao",   quantity: 1, unit_price: 6.5,  subtotal: 6.5, special_requests: "Less spicy" },
      { order_item_id: 2, menu_id: 2, stall_id: 1, stall_name: "Northern Thai", item_name: "Thai Iced Tea", quantity: 2, unit_price: 2.95, subtotal: 5.9, special_requests: null },
    ],
  };
}

export async function getOrdersByCustomerAtStall(stallId, customerName) {
  if (!customerName) return [];
  const all = await getStallOrders(stallId);
  const needle = String(customerName).toLowerCase();
  return all.filter((o) => String(o.customer_name).toLowerCase().includes(needle));
}

// GET `/api/orders?stall_id=${stallId}`,
export async function getActiveStallOrders(stallId) {
  const orders = await getStallOrders(stallId);
  return orders.filter((o) => o.order_status !== "completed" && o.order_status !== "cancelled");
}

export async function updateOrderStatus(orderId, orderStatus) {
  return { order_id: Number(orderId), order_status: orderStatus };
}

export async function createStallOrder(order) {
  return request("/api/orders", {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(order),
  });
}

export async function archiveOrder(orderId) {
  return { order_id: Number(orderId), archived: false, persisted: false };
}

/* ----------------------------------------------------------------- feedback -- */

export async function getStallFeedback(stallId) {
  return [
    { FeedbackId: 1, UserId: 11, UserName: "Wei Ling", FeedbackRating: 5, FeedbackComment: "Best pad kra pao in Maxwell.", FeedbackDateTime: "2026-07-24T12:10:00", FeedbackUpdatedAt: null, ResponseText: null, ResponseDateTime: null },
    { FeedbackId: 2, UserId: 12, UserName: "Marcus",   FeedbackRating: 3, FeedbackComment: "Bit salty today.",             FeedbackDateTime: "2026-07-22T19:05:00", FeedbackUpdatedAt: null, ResponseText: "Sorry about that — we've adjusted the seasoning.", ResponseDateTime: "2026-07-23T08:30:00" },
  ];
}

export async function getStallFeedbackByCustomer(stallId, customerName) {
  if (!customerName) return [];
  const all = await getStallFeedback(stallId);
  const needle = String(customerName).toLowerCase();
  return all.filter((f) => String(f.UserName).toLowerCase().includes(needle));
}

// GET `/api/orders/${orderId}`
export async function getOrderForFeedback(orderId) {
  return getOrderById(orderId);
}

export async function resolveFeedbackWithResponse(feedbackId, response) {
  return { FeedbackId: Number(feedbackId), ResponseText: response, ResponseDateTime: new Date().toISOString() };
}

/* ----------------------------------------------------------------- vouchers -- */

/* ------------------------------------------------------------ notifications -- */

// GET `/vendor/${vendorId}/notifications`
export async function subscribeToVendorNotifications(vendorId, callback) {
  callback(await getNotifications());
  return () => {}; // unsubscribe handle — a no-op, kept so callers don't crash
}

// PUT `/vendor/${vendorId}/notifications/${notificationId}/read`
export async function markVendorNotificationAsRead(notificationId) {
  return markNotificationRead(notificationId);
}

/* ------------------------------------------------------------------ refunds -- */

export async function initiateRefund(orderId, refundType = "full", amount = 0, reason = "") {
  console.warn(
    `initiateRefund is a stub — no refund was issued for order ${orderId}. ` +
      "There is no refund route on the backend yet; see data/vendorData.js.",
  );
  return {
    orderId: String(orderId),
    refundType,
    refundAmount: Number(amount) || 0,
    refundTransactionId: `stub-${Date.now().toString(36)}`,
    reason,
    status: "stubbed",
    persisted: false,
  };
}

export { formatTimeAgo } from "./shared.js";

export {
  getStallById, getStallsByHawkerCentre, getMyStalls, updateStall, setStallOpenStatus,
  getHawkerCentreById, getHawkerCentres,
} from "./shared.js";

export {
  createStall, getStallRequestCentres, checkStallRequest,
  STALL_IMAGE_ACCEPT, STALL_IMAGE_TYPES, STALL_IMAGE_MAX_BYTES, HYGIENE_GRADES,
} from "./shared.js";
