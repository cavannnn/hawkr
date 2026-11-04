import { getSession } from "../data/session.js";
import { showConfirm } from "../assets/js/toast.js";
import { cents, format } from "../assets/js/money.js";
import {
  getOrderHistory,
  getOrder,
  cancelOrder,
  canCancel,
  statusLabel,
  statusTone,
} from "../data/ordersData.js";

const doc = document;

let listToken = 0;

let detailCache = new Map();

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

function dayText(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

function money(value) {
  return value == null ? "" : format(cents(Number(value)));
}

/* ---------------- the list ---------------- */

function view() { return doc.getElementById("view-orders"); }
function listEl() { return doc.querySelector("[data-od-list]"); }

function statusPill(status) {
  const tone = statusTone(status);
  const cls = tone === "cancelled" ? "statusPill sp-pill--unresolved" : "statusPill statusPill--" + tone;
  return '<span class="' + cls + '">' + esc(statusLabel(status)) + "</span>";
}

function rowHtml(row) {
  const meta = [];
  if (row.centreName) meta.push(esc(row.centreName));
  meta.push(row.itemCount === 1 ? "1 item" : row.itemCount + " items");
  if (row.total != null) meta.push(esc(money(row.total)));

  return (
    '<div class="listRowWrap od-row" data-od-order="' + esc(row.orderId) + '">' +
      '<button class="listRow" type="button" aria-expanded="false">' +
        statusPill(row.status) +
        '<span class="listRowMain">' +
          '<span class="listRowName">' + esc(row.stallName || "Order #" + row.orderId) + "</span>" +
          '<span class="listRowMeta">' + meta.join(" · ") + "</span>" +
        "</span>" +
        '<span class="listRowWhen">' + esc(dayText(row.placedAt)) + "</span>" +
      "</button>" +
      '<div class="listRowDetail od-detail"></div>' +
    "</div>"
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

async function renderList() {
  const list = listEl();
  if (!list) return;

  if (!getSession()) {
    list.innerHTML = noteHtml(
      "Sign in to see your orders",
      "An order is tied to the account that placed it,<br>so we can only show yours once you're in.",
      '<button class="sp-submit" type="button" data-od-signin>Sign in</button>',
    );
    return;
  }

  const token = ++listToken;
  detailCache = new Map();
  list.innerHTML = '<span class="skeleton" style="height:64px;border-radius:12px"></span>' +
                   '<span class="skeleton" style="height:64px;border-radius:12px"></span>';

  try {
    const rows = await getOrderHistory();
    if (token !== listToken) return; // a newer render started

    if (!rows.length) {
      list.innerHTML = noteHtml(
        "No orders yet",
        "Once you've bought something, it shows up here<br>with where it's got to.",
        '<button class="sp-submit" type="button" data-od-browse>Browse stalls</button>',
      );
      return;
    }
    list.innerHTML = rows.map(rowHtml).join("");
  } catch (err) {
    if (token !== listToken) return;
    list.innerHTML = noteHtml(
      "Couldn't load your orders",
      esc(err && err.message ? err.message : "Something went wrong.") + "<br>Try again in a moment.",
      '<button class="sp-submit" type="button" data-od-retry>Try again</button>',
    );
  }
}

/* ---------------- one order, opened ---------------- */

function linesHtml(order) {
  const lines = (order && order.items) || [];
  if (!lines.length) return '<p class="od-empty">No lines recorded on this order.</p>';

  return '<ul class="od-lines">' + lines.map((line) => {
    const qty = Number(line.quantity) || 0;
    const original = promoOriginal(line);
    const wasPrice = original ? original * qty : 0;
    return (
      '<li class="od-line">' +
        '<span class="od-line__qty">' + esc(qty) + "×</span>" +
        '<span class="od-line__name">' + esc(line.item_name) +
          (line.stall_name ? '<span class="od-line__stall">' + esc(line.stall_name) + "</span>" : "") +
          (line.special_requests ? '<span class="od-line__note">' + esc(line.special_requests) + "</span>" : "") +
        "</span>" +
        '<span class="od-line__money">' +
          (wasPrice ? '<s class="od-line__was">' + esc(money(wasPrice)) + "</s> " : "") +
          esc(money(line.subtotal)) +
        "</span>" +
      "</li>"
    );
  }).join("") + "</ul>";
}

function promoOriginal(line) {
  const original = Number(line.original_unit_price);
  const unit = Number(line.unit_price);
  if (!isFinite(original) || !isFinite(unit)) return 0;
  return original > unit ? original : 0;
}

function promoSavings(order) {
  return ((order && order.items) || []).reduce(function (sum, line) {
    const original = promoOriginal(line);
    if (!original) return sum;
    const qty = Number(line.quantity) || 0;
    return sum + (original - Number(line.unit_price)) * qty;
  }, 0);
}

function totalsHtml(order) {
  const rows = [];
  const discount = order.discount_amount == null ? 0 : Number(order.discount_amount);
  const savings = promoSavings(order);
  const lineTotal = (order.items || []).reduce(function (sum, line) {
    const value = line.subtotal != null ? Number(line.subtotal) : Number(line.unit_price) * Number(line.quantity);
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const roundUp = order.round_up_amount == null ? 0 : Number(order.round_up_amount);

  if (savings > 0 || discount > 0 || roundUp > 0) {
    rows.push('<span class="od-total__label">Subtotal</span>' +
              '<span class="od-total__value">' + esc(money(lineTotal + savings)) + "</span>");
  }
  if (savings > 0) {
    rows.push('<span class="od-total__label">Stall promotion</span>' +
              '<span class="od-total__value">-' + esc(money(savings)) + "</span>");
  }
  if (discount > 0) {
    const name = order.promotion_name ? esc(order.promotion_name) : "Voucher";
    rows.push('<span class="od-total__label">' + name + "</span>" +
              '<span class="od-total__value">-' + esc(money(discount)) + "</span>");
  }
  if (roundUp > 0) {
    rows.push('<span class="od-total__label">Rounding for Hawkr Harvest</span>' +
              '<span class="od-total__value">' + esc(money(roundUp)) + "</span>");
  }
  rows.push('<span class="od-total__label od-total__label--strong">Total</span>' +
            '<span class="od-total__value od-total__value--strong">' + esc(money(order.total_amount)) + "</span>");
  return '<div class="od-total">' + rows.join("") + "</div>";
}

function detailHtml(order) {
  const facts = [
    ["Placed", whenText(order.order_date) || "—"],
    ["Payment", [order.payment_method, order.payment_status].filter(Boolean).join(" · ") || "—"],
  ];
  if (order.hawker_name) facts.unshift(["Centre", order.hawker_name]);

  const instructions = order.special_instructions
    ? '<p class="od-note">' + esc(order.special_instructions) + "</p>"
    : "";

  const action = canCancel(order.order_status)
    ? '<div class="od-actions">' +
        '<button class="st-delete od-cancel" type="button" data-liquid-glass data-od-cancel>Cancel order</button>' +
      "</div>"
    : "";

  return (
    '<div class="sp-fields od-fields">' +
      facts.map(([label, value]) =>
        '<span class="sp-field__label">' + esc(label) + "</span>" +
        '<span class="sp-field__value">' + esc(value) + "</span>").join("") +
    "</div>" +
    instructions +
    linesHtml(order) +
    totalsHtml(order) +
    action +
    '<p class="sp-error od-error" hidden></p>'
  );
}

async function openRow(wrap) {
  const box = wrap.querySelector(".od-detail");
  const button = wrap.querySelector(".listRow");
  if (!box) return;

  wrap.classList.add("is-open");
  if (button) button.setAttribute("aria-expanded", "true");

  const id = wrap.dataset.odOrder;
  const cached = detailCache.get(id);
  if (cached) { box.innerHTML = detailHtml(cached); glass(box); return; }

  box.innerHTML = '<span class="skeleton" style="height:72px"></span>';
  try {
    const order = await getOrder(id);
    if (!wrap.classList.contains("is-open")) return; // closed again while we were asking
    if (!order) {
      box.innerHTML = '<p class="sp-error">This order is no longer available.</p>';
      return;
    }
    detailCache.set(id, order);
    box.innerHTML = detailHtml(order);
    glass(box);
  } catch (err) {
    box.innerHTML = '<p class="sp-error">' +
      esc(err && err.message ? err.message : "Could not open this order.") + "</p>";
  }
}

function closeRow(wrap) {
  wrap.classList.remove("is-open");
  const button = wrap.querySelector(".listRow");
  if (button) button.setAttribute("aria-expanded", "false");
}

function glass(scope) {
  if (typeof window.initLiquidGlass === "function") window.initLiquidGlass(scope);
}

/* ---------------- cancelling ---------------- */

function rowError(wrap, message) {
  const p = wrap.querySelector(".od-error");
  if (!p) return;
  p.textContent = message || "";
  p.hidden = !message;
}

function repaintRow(wrap, order) {
  const pill = wrap.querySelector(".statusPill");
  if (pill) pill.outerHTML = statusPill(order.order_status);
  const box = wrap.querySelector(".od-detail");
  if (box) { box.innerHTML = detailHtml(order); glass(box); }
}

async function cancel(wrap) {
  const id = wrap.dataset.odOrder;
  const button = wrap.querySelector("[data-od-cancel]");

  const ok = await showConfirm(
    "Cancel this order?",
    "The stall will be told to stop. This can't be undone — you'd have to order again.",
    { confirmLabel: "Cancel order", destructive: true },
  );
  if (!ok) return;

  rowError(wrap, "");
  if (button) { button.disabled = true; button.textContent = "Cancelling…"; }

  try {
    const updated = await cancelOrder(id);
    const order = updated || Object.assign({}, detailCache.get(id), { order_status: "cancelled" });
    detailCache.set(id, order);
    repaintRow(wrap, order);
  } catch (err) {
    if (button) { button.disabled = false; button.textContent = "Cancel order"; }
    rowError(wrap, err && err.message ? err.message : "Could not cancel this order.");
  }
}

/* ---------------- opening ---------------- */

function go(viewName) {
  if (doc.body.dataset.view === viewName) return;
  if (typeof window.navigate === "function") { window.navigate(viewName); return; }
  history.pushState({ view: viewName }, "", "#" + viewName);
  doc.body.dataset.view = viewName;
}

/** Your orders. What the sidebar's History row opens. */
async function open() {
  const already = doc.body.dataset.view === "orders";
  go("orders");
  const v = view();
  if (v) v.scrollTop = 0;
  if (already) await renderList();
}

window.hawkrOrders = { open: open };

/* ---------------- wiring ---------------- */

function init() {
  const v = view();
  if (!v) return;

  doc.addEventListener("click", function (e) {
    if (e.target.closest('[data-sidebar-stub="history"]')) { open(); return; }

    if (!e.target.closest("#view-orders")) return;

    if (e.target.closest("[data-od-back]")) { history.back(); return; }

    if (e.target.closest("[data-menu]")) {
      const m = doc.querySelector('#view-home button[aria-label="Menu"], #view-store button[aria-label="Menu"]');
      if (m) m.click();
      return;
    }

    if (e.target.closest("[data-od-retry]")) { renderList(); return; }
    if (e.target.closest("[data-od-signin]")) { go("login"); return; }
    if (e.target.closest("[data-od-browse]")) { go("home"); return; }

    const cancelBtn = e.target.closest("[data-od-cancel]");
    if (cancelBtn) {
      cancel(cancelBtn.closest(".od-row"));
      return;
    }

    if (e.target.closest(".od-detail")) return;

    const rowBtn = e.target.closest(".listRow");
    if (rowBtn) {
      const wrap = rowBtn.closest(".od-row");
      if (!wrap) return;
      if (wrap.classList.contains("is-open")) closeRow(wrap);
      else openRow(wrap);
    }
  });

  if (typeof window.autoHideBar === "function") {
    window.autoHideBar(v, v.querySelector(".sp-bar"), "sp-bar--hidden", { hideAfter: 64 });
  }

  function syncView() {
    if (doc.body.dataset.view !== "orders") return;
    const bar = v.querySelector(".sp-bar");
    if (bar) bar.classList.remove("sp-bar--hidden"); // always arrive with the bar showing
    renderList();
  }
  new MutationObserver(syncView).observe(doc.body, { attributes: true, attributeFilter: ["data-view"] });
  syncView();
}

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
else init();
