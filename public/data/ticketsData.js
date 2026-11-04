/* ticketsData.js — the support-ticket API layer. */
import { authHeaders } from "./session.js";

export const TICKET_CATEGORIES = [
  "Facility Issue",
  "Cleanliness",
  "Account Issue",
  "Billing/Rental",
  "Order/Payment",
  "Queue/Crowd",
  "Safety Concern",
  "Others",
];

export const IN_FLIGHT_STATUSES = [
  "In Progress",
  "Finding Solution",
  "Testing",
  "Awaiting Response",
];

export const TERMINAL_STATUSES = ["Completed", "Unresolvable"];

export const SLA_BREACH_MS = 48 * 60 * 60 * 1000;

/* -------------------------------------------------------------------- helper -- */

async function ticketRequest(path, options = {}) {
  const res = await fetch(path, { headers: authHeaders(), ...options });

  if (!res.ok) {
    let message = "";
    try {
      const body = await res.json();
      message = body?.error || body?.message || "";
    } catch {
    }
    const err = new Error(message || `${res.status} ${res.statusText} on ${path}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

function query(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") search.append(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/* -------------------------------------------------------------- assigned centres -- */

// GET `/api/tickets/centres/mine`
export async function getMyAssignedCentres() {
  return ticketRequest("/api/tickets/centres/mine");
}

/* ------------------------------------------------------------------- open inbox -- */

// GET `/api/tickets?status=open&category=&exactStatus=&hawkerId=`
export async function getOperatorTickets({ category, exactStatus, hawkerId } = {}) {
  return ticketRequest(
    `/api/tickets${query({ status: "open", category, exactStatus, hawkerId })}`,
  );
}

/* ---------------------------------------------------------------------- history -- */

// GET `/api/tickets/history?category=&outcome=&dateFrom=&dateTo=`
export async function getOperatorTicketHistory({ category, outcome, dateFrom, dateTo } = {}) {
  return ticketRequest(`/api/tickets/history${query({ category, outcome, dateFrom, dateTo })}`);
}

/* ----------------------------------------------------------------------- detail -- */

// GET `/api/tickets/${ticketId}`
export async function getTicketById(ticketId) {
  try {
    return await ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}`);
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export function attachmentUrl(attachment) {
  return attachment.StoragePath;
}

/* -------------------------------------------------------------- operator actions -- */

// PATCH `/api/tickets/${ticketId}/claim`
export async function claimTicket(ticketId) {
  return ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}/claim`, {
    method: "PATCH",
  });
}

// PATCH `/api/tickets/${ticketId}/status`
export async function updateTicketStatus(ticketId, status) {
  return ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ Status: status }),
  });
}

// POST `/api/tickets/${ticketId}/complete`
export async function completeTicket(ticketId, { Outcome, Message }) {
  if (!TERMINAL_STATUSES.includes(Outcome)) {
    throw new Error("Choose whether this ticket was resolved or could not be resolved.");
  }
  if (!Message || !Message.trim()) {
    throw new Error("A resolution message is required to close a ticket.");
  }

  return ticketRequest(`/api/tickets/${encodeURIComponent(ticketId)}/complete`, {
    method: "POST",
    body: JSON.stringify({ Outcome, Message: Message.trim() }),
  });
}
