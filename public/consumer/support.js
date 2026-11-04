import { getSession } from "../data/session.js";
import {
  TICKET_CATEGORIES,
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENTS,
  SUBJECT_MAX,
  getHawkerCentres,
  getMyTickets,
  getMyTicketById,
  createTicket,
  checkAttachments,
  attachmentUrl,
  outcomeLabel,
  isClosed,
} from "../data/myTicketsData.js";

const doc = document;

let tab = "open";

let centreNames = new Map();

let listToken = 0;

let chosenFiles = [];

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}

function shortDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fullDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function fileSize(bytes) {
  if (bytes == null) return "";
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? mb.toFixed(1) + " MB" : Math.max(1, Math.round(bytes / 1024)) + " KB";
}

function statusPill(status) {
  if (status === "Completed") {
    return '<span class="statusPill statusPill--done">Resolved</span>';
  }
  if (status === "Unresolvable") {
    return '<span class="statusPill sp-pill--unresolved">Unresolvable</span>';
  }
  if (status === "Open") {
    return '<span class="statusPill statusPill--waiting">Open</span>';
  }
  return '<span class="statusPill statusPill--active">' + esc(status) + "</span>";
}

/* ---------------- your tickets ---------------- */

function ticketsView() { return doc.getElementById("view-tickets"); }
function listEl() { return doc.querySelector("[data-sp-list]"); }

function cardHtml(t) {
  const closed = isClosed(t);
  const centre = centreNames.get(Number(t.HawkerId));
  const category = t.Category === "Others" && t.OtherCategoryText
    ? "Others — " + t.OtherCategoryText
    : t.Category;
  const meta = centre ? esc(category) + " · " + esc(centre) : esc(category);
  const when = closed && t.history ? t.history.CompletedAt : t.CreatedAt;

  let reply = "";
  if (closed) {
    const message = t.history && t.history.Message && t.history.Message.trim();
    const outcome = (t.history && t.history.Status) || t.Status;
    reply =
      '<div class="sp-reply">' +
        '<p class="sp-reply__title">' +
          (outcome === "Completed"
            ? "What was done"
            : "Why this could not be resolved") +
        "</p>" +
        '<p class="sp-reply__body">' +
          esc(message || "This ticket was closed as " + outcomeLabel(outcome).toLowerCase() +
                         ", but no message was recorded with it.") +
        "</p>" +
      "</div>";
  }

  return (
    '<button class="sp-card' + (closed ? " sp-card--closed" : "") + '" type="button"' +
    ' data-ticket="' + esc(t.TicketId) + '" aria-expanded="false">' +
      '<span class="sp-card__top">' +
        statusPill(closed && t.history ? t.history.Status : t.Status) +
        '<span class="sp-card__when">' + esc(shortDate(when)) + "</span>" +
        '<span class="sp-card__chev" aria-hidden="true"></span>' +
      "</span>" +
      '<p class="sp-card__subject">' + esc(t.Subject) + "</p>" +
      '<p class="sp-card__meta">' + meta + "</p>" +
      reply +
      '<span class="sp-card__more" data-sp-more></span>' +
    "</button>"
  );
}

function noteHtml(title, sub, action) {
  return (
    '<div class="sp-note">' +
      '<img class="sp-note__art" src="../images/squirrelShrugging.svg" alt="" width="132" height="137">' +
      "<div>" +
        '<p class="sp-note__ttl">' + esc(title) + "</p>" +
        '<p class="sp-note__sub">' + sub + "</p>" +
      "</div>" +
      (action || "") +
    "</div>"
  );
}

async function loadCentreNames() {
  if (centreNames.size) return;
  try {
    const centres = await getHawkerCentres();
    centreNames = new Map((centres || []).map((c) => [Number(c.HawkerId), c.Name]));
  } catch {
    /* Best-effort. A card without a centre name still says everything else it needs to. */
  }
}

function setNoteMode(on) {
  const v = ticketsView();
  if (!v) return;
  if (on) v.dataset.note = "1";
  else delete v.dataset.note;
}

async function renderList() {
  const list = listEl();
  if (!list) return;

  if (!getSession()) {
    setNoteMode(true);
    list.innerHTML = noteHtml(
      "Sign in to see your tickets",
      "Support tickets are tied to your account,<br>so we can send the reply back to you.",
      '<button class="sp-submit" type="button" data-sp-signin>Sign in</button>',
    );
    return;
  }

  const token = ++listToken;
  setNoteMode(false);
  list.innerHTML = '<span class="skeleton" style="height:132px;border-radius:24px"></span>' +
                   '<span class="skeleton" style="height:132px;border-radius:24px"></span>';

  loadCentreNames(); // in parallel; the list does not wait on it

  try {
    const tickets = await getMyTickets(tab);
    if (token !== listToken) return; // a newer render started

    if (!tickets || !tickets.length) {
      setNoteMode(true);
      list.innerHTML =
        tab === "open"
          ? noteHtml(
              "Nothing open",
              "When something goes wrong at a centre,<br>tell us and we'll get it to the right people.",
              '<button class="sp-submit" type="button" data-sp-new>Raise a ticket</button>',
            )
          : noteHtml(
              "No answers yet",
              "Tickets move here once someone has<br>resolved them or explained why they can't.",
              '<button class="sp-submit" type="button" data-sp-new>Raise a ticket</button>',
            );
      return;
    }
    setNoteMode(false);
    list.innerHTML = tickets.map(cardHtml).join("");
  } catch (err) {
    if (token !== listToken) return;
    setNoteMode(true);
    list.innerHTML = noteHtml(
      "Couldn't load your tickets",
      esc(err && err.message ? err.message : "Something went wrong.") + "<br>Try again in a moment.",
      '<button class="sp-submit" type="button" data-sp-retry>Try again</button>',
    );
  }
}

/* ---------------- one ticket, opened ---------------- */

function fieldsHtml(t) {
  const rows = [["Centre", t.HawkerName || centreNames.get(Number(t.HawkerId)) || "—"]];
  rows.push(["Raised", fullDate(t.CreatedAt)]);
  if (t.history) {
    rows.push(["Answered by", t.history.ResolvedByUserName || "Support"]);
    rows.push(["Answered", fullDate(t.history.CompletedAt)]);
  }
  return (
    '<span class="sp-fields">' +
    rows
      .map(
        ([label, value]) =>
          '<span class="sp-field__label">' + esc(label) + "</span>" +
          '<span class="sp-field__value">' + esc(value) + "</span>",
      )
      .join("") +
    "</span>"
  );
}

function attsHtml(attachments) {
  if (!attachments || !attachments.length) return "";
  return (
    '<span class="sp-atts">' +
    attachments
      .map((a) => {
        const url = esc(attachmentUrl(a));
        const media = String(a.FileType || "").startsWith("video/")
          ? '<video src="' + url + '" muted></video>'
          : '<img src="' + url + '" alt="">';
        return (
          '<a class="sp-att" href="' + url + '" target="_blank" rel="noopener noreferrer">' +
          media +
          '<span class="sp-att__name">' + esc(a.FileName) + "</span></a>"
        );
      })
      .join("") +
    "</span>"
  );
}

async function openCard(card) {
  const more = card.querySelector("[data-sp-more]");
  if (!more) return;

  card.classList.add("is-open");
  card.setAttribute("aria-expanded", "true");
  more.innerHTML = '<span class="skeleton" style="height:72px"></span>';

  try {
    const t = await getMyTicketById(card.dataset.ticket);
    if (!t) {
      more.innerHTML = '<p class="sp-error">This ticket is no longer available.</p>';
      return;
    }
    more.innerHTML =
      fieldsHtml(t) +
      '<span class="sp-block">' +
        '<span class="sp-block__title">What you reported</span>' +
        '<span class="sp-block__body">' + esc(t.Description) + "</span>" +
      "</span>" +
      attsHtml(t.attachments);
  } catch (err) {
    more.innerHTML =
      '<p class="sp-error">' +
      esc(err && err.message ? err.message : "Could not open this ticket.") +
      "</p>";
  }
}

function closeCard(card) {
  card.classList.remove("is-open");
  card.setAttribute("aria-expanded", "false");
  const more = card.querySelector("[data-sp-more]");
  if (more) more.innerHTML = "";
}

/* ---------------- raise a ticket ---------------- */

function formEl() { return doc.getElementById("sp-form"); }

function formError(message) {
  const p = doc.querySelector("[data-sp-formerror]");
  if (!p) return;
  p.textContent = message || "";
  p.hidden = !message;
}

function renderChosen() {
  const box = doc.querySelector("[data-sp-chosen]");
  if (!box) return;
  box.innerHTML = chosenFiles
    .map(
      (f, i) =>
        '<div class="sp-chosen__row">' +
          '<span class="sp-chosen__name">' + esc(f.name) + "</span>" +
          '<span class="sp-chosen__size">' + esc(fileSize(f.size)) + "</span>" +
          '<button class="sp-chosen__remove" type="button" data-sp-remove="' + i + '"' +
            ' aria-label="Remove ' + esc(f.name) + '">Remove</button>' +
        "</div>",
    )
    .join("");
}

function sameFile(a, b) {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

function addFiles(picked) {
  const kept = [];
  const rejected = [];

  picked.forEach((file) => {
    if (chosenFiles.some((f) => sameFile(f, file))) return; // already attached — silently ignored
    const problem = checkAttachments([file]);
    if (problem) rejected.push(problem);
    else kept.push(file);
  });

  const room = Math.max(MAX_ATTACHMENTS - chosenFiles.length, 0);
  const admitted = kept.slice(0, room);
  const overflow = kept.length - admitted.length;

  chosenFiles = chosenFiles.concat(admitted);

  if (overflow > 0) {
    rejected.push(
      `You can attach up to ${MAX_ATTACHMENTS} files, so ${overflow} of these weren't added.`,
    );
  }

  const others = rejected.length - 1;
  if (!rejected.length) formError("");
  else if (others === 0) formError(rejected[0]);
  else if (others === 1) formError(rejected[0] + " One other file was left out too.");
  else formError(rejected[0] + " " + others + " other files were left out too.");

  renderChosen();
}

function removeChosen(index) {
  if (index < 0 || index >= chosenFiles.length) return;
  chosenFiles.splice(index, 1);
  formError("");   // whatever the message was, the selection it described has changed
  renderChosen();
}

async function loadCentres() {
  const select = doc.getElementById("sp-centre");
  const submit = doc.querySelector("[data-sp-submit]");
  if (!select) return;

  select.innerHTML = '<option value="">Loading…</option>';
  select.disabled = true;

  try {
    const centres = await getHawkerCentres();
    centreNames = new Map((centres || []).map((c) => [Number(c.HawkerId), c.Name]));
    if (!centres || !centres.length) {
      select.innerHTML = '<option value="">No centres available</option>';
      return;
    }
    select.innerHTML =
      '<option value="">Choose a centre</option>' +
      centres
        .map((c) => '<option value="' + esc(c.HawkerId) + '">' + esc(c.Name) + "</option>")
        .join("");
    select.disabled = false;
    if (submit) submit.disabled = false;
    formError("");
  } catch (err) {
    select.innerHTML = '<option value="">Couldn\'t load centres</option>';
    if (submit) submit.disabled = true;
    formError(
      (err && err.message ? err.message : "Could not load the hawker centres.") +
        " A ticket has to name one, so it can't be sent until this loads.",
    );
  }
}

function resetForm() {
  const form = formEl();
  if (form) form.reset();
  chosenFiles = [];
  renderChosen();
  formError("");
  syncOther();
  syncCount();
}

function syncOther() {
  const category = doc.getElementById("sp-category");
  const field = doc.querySelector("[data-sp-other]");
  if (!category || !field) return;
  field.hidden = category.value !== "Others";
}

function syncCount() {
  const subject = doc.getElementById("sp-subject");
  const count = doc.querySelector("[data-sp-count]");
  if (!subject || !count) return;
  const n = subject.value.length;
  count.textContent = n + "/" + SUBJECT_MAX;
  count.classList.toggle("is-over", n > SUBJECT_MAX);
}

async function submitTicket() {
  const submit = doc.querySelector("[data-sp-submit]");
  if (!submit || submit.disabled) return;

  formError("");
  submit.disabled = true;
  const label = submit.textContent;
  submit.textContent = "Sending…";

  try {
    await createTicket({
      HawkerId: doc.getElementById("sp-centre").value,
      Category: doc.getElementById("sp-category").value,
      OtherCategoryText: doc.getElementById("sp-other").value,
      Subject: doc.getElementById("sp-subject").value,
      Description: doc.getElementById("sp-description").value,
      files: chosenFiles,
    });

    resetForm();
    tab = "open";
    syncTabs();
    open();
  } catch (err) {
    formError(err && err.message ? err.message : "Could not send this ticket.");
  } finally {
    submit.disabled = false;
    submit.textContent = label;
  }
}

/* ---------------- opening ---------------- */

function go(view) {
  if (doc.body.dataset.view === view) return;
  if (typeof window.navigate === "function") {
    window.navigate(view);
    return;
  }
  history.pushState({ view: view }, "", "#" + view);
  doc.body.dataset.view = view;
}

/** Your tickets. What the sidebar's Support row opens. */
async function open() {
  const already = doc.body.dataset.view === "tickets";
  go("tickets");
  const v = ticketsView();
  if (v) v.scrollTop = 0;
  if (already) await renderList();
}

/** The form. One step in from the list. */
async function openNew() {
  if (!getSession()) {
    go("login");
    return;
  }
  const already = doc.body.dataset.view === "newticket";
  go("newticket");
  const v = doc.getElementById("view-newticket");
  if (v) v.scrollTop = 0;
  if (already) await loadCentres();
}

window.hawkrSupport = { open: open, openNew: openNew };

/* ---------------- wiring ---------------- */

function syncTabs() {
  doc.querySelectorAll("[data-sp-tab]").forEach((b) => {
    b.setAttribute("aria-checked", String(b.dataset.spTab === tab));
  });
  const seg = doc.querySelector(".sp-seg");
  if (seg) seg.dataset.tab = tab;
}

function init() {
  const list = ticketsView();
  const form = doc.getElementById("view-newticket");
  if (!list || !form) return;

  syncTabs();

  doc.addEventListener("click", function (e) {
    if (e.target.closest('[data-sidebar-stub="support"]')) { open(); return; }

    const inSupport = e.target.closest("#view-tickets, #view-newticket");
    if (!inSupport) return;

    if (e.target.closest("[data-sp-back]")) { history.back(); return; }

    if (e.target.closest("[data-menu]")) {
      const m = doc.querySelector('#view-home button[aria-label="Menu"], #view-store button[aria-label="Menu"]');
      if (m) m.click();
      return;
    }

    const remove = e.target.closest("[data-sp-remove]");
    if (remove) { removeChosen(Number(remove.dataset.spRemove)); return; }

    if (e.target.closest("[data-sp-new]")) { openNew(); return; }
    if (e.target.closest("[data-sp-retry]")) { renderList(); return; }
    if (e.target.closest("[data-sp-signin]")) { go("login"); return; }
    if (e.target.closest("[data-sp-submit]")) { submitTicket(); return; }

    const tabBtn = e.target.closest("[data-sp-tab]");
    if (tabBtn) {
      if (tabBtn.dataset.spTab === tab) return;
      tab = tabBtn.dataset.spTab;
      syncTabs();
      renderList();
      return;
    }

    if (e.target.closest(".sp-att")) return;

    const card = e.target.closest(".sp-card");
    if (card) {
      if (card.classList.contains("is-open")) closeCard(card);
      else openCard(card);
    }
  });

  const category = doc.getElementById("sp-category");
  if (category) {
    category.insertAdjacentHTML(
      "beforeend",
      TICKET_CATEGORIES.map((c) => '<option value="' + esc(c) + '">' + esc(c) + "</option>").join(""),
    );
  }

  const fileInput = doc.getElementById("sp-files");
  if (fileInput) {
    fileInput.accept = ATTACHMENT_ACCEPT;
    fileInput.addEventListener("change", function () {
      addFiles(Array.from(fileInput.files || []));
      fileInput.value = "";
    });
  }

  doc.addEventListener("change", function (e) {
    if (e.target.id === "sp-category") syncOther();
  });
  doc.addEventListener("input", function (e) {
    if (e.target.id === "sp-subject") syncCount();
  });

  const theForm = formEl();
  if (theForm) {
    theForm.addEventListener("submit", function (e) {
      e.preventDefault();
      submitTicket();
    });
  }

  if (typeof window.autoHideBar === "function") {
    window.autoHideBar(list, list.querySelector(".sp-bar"), "sp-bar--hidden", { hideAfter: 64 });
    window.autoHideBar(form, form.querySelector(".sp-bar"), "sp-bar--hidden", { hideAfter: 64 });
  }

  syncOther();
  syncCount();

  function syncView() {
    const view = doc.body.dataset.view;
    if (view === "tickets") {
      const bar = list.querySelector(".sp-bar");
      if (bar) bar.classList.remove("sp-bar--hidden"); // always arrive with the bar showing
      renderList();
    } else if (view === "newticket") {
      const bar = form.querySelector(".sp-bar");
      if (bar) bar.classList.remove("sp-bar--hidden");
      loadCentres();
    }
  }
  new MutationObserver(syncView).observe(doc.body, { attributes: true, attributeFilter: ["data-view"] });
  syncView();
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
else init();
