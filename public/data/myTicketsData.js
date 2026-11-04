import { getSession, authHeaders } from "./session.js";
import { TICKET_CATEGORIES, TERMINAL_STATUSES, attachmentUrl } from "./ticketsData.js";

export { TICKET_CATEGORIES, TERMINAL_STATUSES, attachmentUrl };

/* ------------------------------------------------------------------- limits -- */

export const ATTACHMENT_ACCEPT = "image/jpeg,image/png,video/mp4,video/quicktime";
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "video/mp4", "video/quicktime"];
export const MAX_ATTACHMENTS = 10;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
export const SUBJECT_MAX = 150;

/* ---------------------------------------------------------------- transport -- */

async function send(path, options = {}) {
  const res = await fetch(path, options);

  let body = null;
  try {
    body = await res.json();
  } catch {
  }

  if (!res.ok) {
    const err = new Error((body && body.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

function readHeaders() {
  return { headers: authHeaders() };
}

/* --------------------------------------------------------------- the centres -- */

// GET `/api/tickets/centres`
export async function getHawkerCentres() {
  return send("/api/tickets/centres", readHeaders());
}

/* ----------------------------------------------------------------- my tickets -- */

// GET `/api/tickets?status=open|closed`
export async function getMyTickets(group) {
  const status = group === "closed" ? "closed" : "open";
  return send(`/api/tickets?status=${status}`, readHeaders());
}

// GET `/api/tickets/${ticketId}`
export async function getMyTicketById(ticketId) {
  return send(`/api/tickets/${encodeURIComponent(ticketId)}`, readHeaders());
}

/* --------------------------------------------------------------- raise one -- */

export function checkAttachments(files) {
  const list = Array.from(files || []);
  if (!list.length) return null;

  if (list.length > MAX_ATTACHMENTS) {
    return `You can attach up to ${MAX_ATTACHMENTS} files.`;
  }

  for (const file of list) {
    if (!ATTACHMENT_TYPES.includes(file.type)) {
      return `${file.name} is not a supported file. Use a JPG, PNG, MP4 or MOV.`;
    }
    const isImage = file.type.startsWith("image/");
    const limit = isImage ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > limit) {
      return `${file.name} is too large. Images must be under 5MB, videos under 50MB.`;
    }
  }
  return null;
}

export function checkTicket({ HawkerId, Category, OtherCategoryText, Subject, Description }) {
  if (!HawkerId) return "Choose the hawker centre this is about.";
  if (!Category) return "Choose a category.";
  if (Category === "Others" && !String(OtherCategoryText || "").trim()) {
    return "Describe the category.";
  }
  if (!String(Subject || "").trim()) return "Give it a subject.";
  if (String(Subject).trim().length > SUBJECT_MAX) {
    return `The subject has to be ${SUBJECT_MAX} characters or fewer.`;
  }
  if (!String(Description || "").trim()) return "Describe what happened.";
  return null;
}

// POST `/api/tickets`
export async function createTicket({
  HawkerId,
  Category,
  OtherCategoryText,
  Subject,
  Description,
  files,
}) {
  const problem = checkTicket({ HawkerId, Category, OtherCategoryText, Subject, Description });
  if (problem) throw new Error(problem);

  const fileProblem = checkAttachments(files);
  if (fileProblem) throw new Error(fileProblem);

  const form = new FormData();
  form.append("HawkerId", String(HawkerId));
  form.append("Category", Category);
  form.append("OtherCategoryText", String(OtherCategoryText || "").trim());
  form.append("Subject", String(Subject).trim());
  form.append("Description", String(Description).trim());
  Array.from(files || []).forEach((f) => form.append("attachments", f));

  const session = getSession();
  return send("/api/tickets", {
    method: "POST",
    headers: session ? { Authorization: "Bearer " + session.token } : {},
    body: form,
  });
}

/* ------------------------------------------------------------------ helpers -- */

export function outcomeLabel(status) {
  return status === "Completed" ? "Resolved" : "Unresolvable";
}

export function isClosed(ticket) {
  return TERMINAL_STATUSES.includes(ticket && ticket.Status);
}
