import { getOrderHistory, getOrder, isLocalOrderId, request } from "./reviewsData.js";

export { getOrderHistory, getOrder, isLocalOrderId };

/* ------------------------------------------------------------------ statuses -- */

export const ORDER_STATUSES = ["pending", "preparing", "ready", "completed", "cancelled"];
export const PROGRESS = ["pending", "preparing", "ready", "completed"];

const LABELS = {
  pending: "Order placed",
  preparing: "Being made",
  ready: "Ready to collect",
  completed: "Collected",
  cancelled: "Cancelled",
};

export function statusLabel(status) {
  const key = String(status || "").toLowerCase();
  return LABELS[key] || (status ? String(status) : "Unknown");
}

export function statusTone(status) {
  const key = String(status || "").toLowerCase();
  if (key === "pending") return "waiting";
  if (key === "preparing" || key === "ready") return "active";
  if (key === "completed") return "done";
  return "cancelled"; // and anything unrecognised — neutral is the honest default
}

export function canCancel(status) {
  const key = String(status || "").toLowerCase();
  return key === "pending" || key === "preparing" || key === "ready";
}

/* --------------------------------------------------------------- cancelling -- */

export async function cancelOrder(orderId) {
  if (isLocalOrderId(orderId)) {
    throw new Error("This order was only ever recorded on this device, so there is nothing to cancel.");
  }
  const body = await request(`/api/orders/${encodeURIComponent(orderId)}/status`, {
    method: "PUT",
    body: JSON.stringify({ order_status: "cancelled" }),
  });
  return (body && body.data) || null;
}
