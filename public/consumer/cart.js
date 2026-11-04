/* cart.js — the Cart page (#view-cart, Figma 683:2086). */
(function (global, doc) {
  "use strict";

  var REDUCE = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var M = global.hawkrMoney;
  var B = global.hawkrBag;

  function view() { return doc.getElementById("view-cart"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  }); }

  /* ---------------- stall groups + lines ---------------- */

  function stepperHtml(qty, dishName) {
    return '<div class="qstep qstep--compact">' +
      '<div class="qstep__count" data-liquid-glass role="spinbutton" aria-valuemin="0" aria-valuemax="99" aria-valuenow="' + qty + '" aria-label="Quantity">' +
        '<span class="qstep__num">' + qty + "</span></div>" +
      '<div class="qstep__pill" data-liquid-glass>' +
        '<button class="qstep__btn qdec" type="button" aria-label="' + (qty === 1 ? "Remove " + esc(dishName) : "Decrease quantity") + '">' +
          '<svg width="14" height="2" viewBox="0 0 14 2" fill="none" aria-hidden="true"><path d="M1 1H13" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round"/></svg></button>' +
        '<span class="qstep__sep"></span>' +
        '<button class="qstep__btn qinc" type="button" aria-label="Increase quantity">' +
          '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1V13M1 7H13" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round"/></svg></button>' +
      "</div></div>";
  }

  function lineHtml(l) {
    return '<div class="ct-line" data-line="' + l.id + '">' +
      '<img class="ct-line__img" src="' + esc(l.dish.img) + '" alt=""' + (window.hawkrImgFallbackAttr ? window.hawkrImgFallbackAttr(l.dish) : "") + '>' +
      '<div class="ct-line__body">' +
        '<div class="ct-line__top">' +
          '<div class="ct-line__head">' +
            '<span class="ct-line__name">' + esc(l.dish.name) + "</span>" +
            '<button class="ct-edit" type="button" data-edit="' + l.id + '">Edit</button>' +
          "</div>" +
          (l.remarks ? '<p class="ct-line__remarks">' + esc(l.remarks) + "</p>" : "") +
        "</div>" +
        '<div class="ct-line__foot">' +
          '<span class="ct-line__price">' + M.format(l.unit) + "</span>" +
          '<div class="ct-line__qty">' + stepperHtml(l.qty, l.dish.name) + "</div>" +
        "</div>" +
      "</div></div>";
  }

  var DISCOUNT_AUTHOR = {
    "centre-promotion": "Centre",
    "vendor-promotion": "Stall",
    voucher: "Voucher",
  };

  function promoRowsHtml(g) {
    if (!g.discounts || !g.discounts.length) return "";
    return g.discounts.map(function (d) {
      var who = DISCOUNT_AUTHOR[d.source] || "Discount";
      return '<div class="ct-subtotal ct-subtotal--promo" data-stall-promo>' +
        "<span>" + esc(who + ": " + d.label + " — " + d.name) + "</span>" +
        "<span data-stall-discount>−" + M.format(d.amountCents) + "</span></div>";
    }).join("");
  }

  function closedRowHtml(g) {
    var C = global.hawkrCentre;
    if (!C || !C.isClosed(g.store)) return "";
    var line = C.closureLine(g.store);
    return '<p class="ct-stall__closed">' + esc(line ? line.long : "This hawker centre is closed.") + "</p>";
  }

  function groupHtml(g) {
    var s = g.storeRef;
    var dist = s && typeof global.distanceLabel === "function" ? global.distanceLabel(s) : "";
    var sub = s ? '<span class="ct-stall__sub">' +
      '<span class="ct-stall__at">@ ' + esc(s.location) + "</span>" +
      (dist ? '<span class="ct-dot" aria-hidden="true"></span><span class="ct-stall__dist">' + esc(dist) + "</span>" : "") +
      "</span>" : "";
    return '<div class="ct-group" data-group="' + esc(g.store) + '">' +
      '<div class="ct-stall">' +
        (s ? '<img class="ct-stall__thumb" src="' + esc(s.img) + '" alt=""' + (window.hawkrImgFallbackAttr ? window.hawkrImgFallbackAttr(s) : "") + '>' : "") +
        "<span>" +
          '<h2 class="ct-stall__name">' + esc(g.store) + "</h2>" + sub +
        "</span>" +
      "</div>" +
      closedRowHtml(g) +
      g.lines.map(lineHtml).join("") +
      '<div class="ct-subtotal"><span>Subtotal</span><span data-stall-subtotal>' + M.format(g.subtotal) + "</span></div>" +
      promoRowsHtml(g) +
      "</div>";
  }

  function renderGroups() {
    var box = view() && view().querySelector("[data-cart-groups]");
    if (!box) return;
    box.innerHTML = B.groups().map(groupHtml).join("");
    if (typeof global.initLiquidGlass === "function") global.initLiquidGlass(box);
  }

  // Surgical: only the things a quantity change can actually alter.
  function patchLine(id) {
    var v = view(); if (!v) return;
    var l = B.line(id);
    var row = v.querySelector('[data-line="' + id + '"]');
    if (!l || !row) return;
    row.querySelector(".qstep__num").textContent = l.qty;
    row.querySelector(".qstep__count").setAttribute("aria-valuenow", l.qty);
    // honest to a screen reader: at 1 the − IS the remove control
    row.querySelector(".qdec").setAttribute("aria-label", l.qty === 1 ? "Remove " + l.dish.name : "Decrease quantity");
    var group = row.closest(".ct-group");
    var g = B.groups().filter(function (x) { return x.store === group.dataset.group; })[0];
    if (g) {
      group.querySelector("[data-stall-subtotal]").textContent = M.format(g.subtotal);
      [].slice.call(group.querySelectorAll("[data-stall-promo]")).forEach(function (n) { n.remove(); });
      var wanted = promoRowsHtml(g);
      if (wanted) group.insertAdjacentHTML("beforeend", wanted);
    }
    renderVoucher();
    renderTotals();
  }

  function removeLine(id) {
    var v = view();
    var row = v && v.querySelector('[data-line="' + id + '"]');
    var drop = function () {
      B.remove(id);
      renderGroups(); renderCentres(); renderVoucher(); renderTotals(); syncEmpty();
    };
    if (REDUCE || !row) { drop(); return; }
    // the app's existing delete-a-row vocabulary (settings-page.js): shrink+fade, then reflow
    var others = [].slice.call(v.querySelectorAll(".ct-line")).filter(function (n) { return n !== row; });
    var first = others.map(function (n) { return { id: n.dataset.line, r: n.getBoundingClientRect() }; });
    row.classList.add("is-removing");
    setTimeout(function () {
      drop();
      first.forEach(function (m) {
        var n = v.querySelector('[data-line="' + m.id + '"]');
        if (!n) return;
        var r = n.getBoundingClientRect();
        var dy = m.r.top - r.top;
        if (!dy) return;
        n.style.transition = "none";
        n.style.transform = "translateY(" + dy + "px)";
        requestAnimationFrame(function () { n.style.transition = ""; n.style.transform = ""; });
      });
    }, 240);
  }

  /* ---------------- collection details ---------------- */
  function renderCentres() {
    var box = view() && view().querySelector("[data-cart-centres]");
    if (!box) return;
    var seen = {}, out = [];
    B.groups().forEach(function (g) {
      var name = g.storeRef && g.storeRef.location;
      if (!name || seen[name]) return;
      seen[name] = true;
      out.push(typeof CENTRES !== "undefined" && CENTRES[name] ? CENTRES[name] : { name: name });
    });
    box.innerHTML = out.map(function (c) {
      var C = global.hawkrCentre;
      var st = C ? C.forCentre(c.name) : null;
      var closure = "";
      if (st && st.closure) {
        var name = st.closure.state === "closed" ? "ct-collect__closed" : "ct-collect__soon";
        var words = st.closure.state === "closed"
          ? "Closed right now — you cannot collect from here."
          : "Closing soon. Check before you travel.";
        closure = '<p class="ct-collect__sub ' + name + '">' + words + "</p>";
      }
      return '<div class="ct-collect__row">' +
          '<img class="ct-collect__icon" src="../images/cart-collect-pin.svg" alt="">' +
          '<span class="ct-collect__body">' +
            '<span class="ct-collect__name">' + esc(c.name) + "</span>" +
            (c.addr ? '<p class="ct-collect__sub">' + esc(c.addr) + "</p>" : "") +
            closure +
          "</span></div>" +
        '<div class="ct-collect__row">' +
          '<img class="ct-collect__icon" src="../images/cart-collect-clock.svg" alt="">' +
          '<span class="ct-collect__body">' +
            // SEAM: static Figma copy. A real prep-queue ETA replaces both numbers.
            '<span class="ct-collect__name">Pick up in 9 minutes</span>' +
            '<p class="ct-collect__sub">The vendor will only secure your order for 15 minutes.</p>' +
          "</span></div>";
    }).join("");
  }

  /* ---------------- who is collecting ---------------- */
  function realName() {
    var pr = global.hawkrProfile && global.hawkrProfile.get();
    var n = pr && pr.name != null ? String(pr.name).trim() : "";
    return n.length >= 2 ? n.slice(0, 100) : null;
  }

  function ordersAsCustomer() {
    var S = global.hawkrSession;
    if (!S || !S.getSession()) return false;
    return String(S.getRole() || "").toLowerCase() === "customer";
  }

  function whoHtml() {
    var name = realName();
    var guest = !ordersAsCustomer();
    var guestLine = guest
      ? '<p class="ct-collect__sub">Ordering as a guest — this order will not appear in your history and cannot be reviewed afterwards.</p>'
      : "";
    if (name) {
      return '<div class="ct-who__row">' +
          '<span class="ct-collect__body">' +
            '<span class="ct-collect__name">Collecting as ' + esc(name) + "</span>" +
            '<p class="ct-collect__sub">The stall calls this name when your food is ready.</p>' +
            guestLine +
          "</span>" +
          '<button class="ct-placed__rename" type="button" data-who-edit>Change</button>' +
        "</div>" +
        '<div class="ct-placed__row" data-who-row hidden>' +
          '<input class="ct-placed__input" type="text" maxlength="100" data-who-input value="' + esc(name) + '" placeholder="Your name" aria-label="Name for collection">' +
          '<button class="ct-placed__save" type="button" data-who-save>Save</button>' +
        "</div>";
    }
    return '<div class="ct-who__row">' +
        '<span class="ct-collect__body">' +
          '<span class="ct-collect__name">Who is collecting?</span>' +
          '<p class="ct-collect__sub">The stall needs a name to call out. Needed before you can order.</p>' +
          guestLine +
        "</span>" +
      "</div>" +
      '<div class="ct-placed__row" data-who-row>' +
        '<input class="ct-placed__input" type="text" maxlength="100" data-who-input placeholder="Your name" aria-label="Name for collection">' +
        '<button class="ct-placed__save" type="button" data-who-save>Save</button>' +
      "</div>";
  }

  function renderWho() {
    var box = view() && view().querySelector("[data-cart-who]");
    if (!box) return;
    box.innerHTML = whoHtml();
  }

  function saveWho() {
    var v = view(); if (!v) return;
    var input = v.querySelector("[data-who-input]");
    var val = input ? input.value.trim() : "";
    if (val.length < 2) { if (input) input.focus(); return; } // the validator's own floor
    if (global.hawkrProfile) global.hawkrProfile.promoteToName(val.slice(0, 100));
    renderWho();
    syncConfirm();
  }

  /* ---------------- voucher ---------------- */
  var voucherBusy = false;
  var voucherMessage = null;   // { text, ok } — cleared on the next successful render

  function appliedVoucher() { return B.voucher(); }

  function voucherHtml() {
    var v = appliedVoucher();
    var msg = voucherMessage
      ? '<p class="ct-voucher__msg ' + (voucherMessage.ok ? "ct-voucher__msg--ok" : "ct-voucher__msg--bad") + '">' +
          esc(voucherMessage.text) + "</p>"
      : "";

    if (v) {
      var group = B.groups().filter(function (g) { return g.store === v.store; })[0];
      var entry = group && (group.discounts || []).filter(function (d) { return d.source === "voucher"; })[0];
      var worth = entry ? entry.amountCents : 0;
      return '<div class="ct-voucher__row">' +
          '<span class="ct-collect__body">' +
            '<span class="ct-collect__name ct-voucher__code">' + esc(v.code) + "</span>" +
            '<p class="ct-collect__sub">' +
              (worth > 0
                ? "−" + M.format(worth) + " off " + esc(v.store)
                : "Applied to " + esc(v.store) + " — nothing left for it to take off.") +
            "</p>" +
          "</span>" +
          '<button class="ct-voucher__clear" type="button" data-voucher-clear>Remove</button>' +
        "</div>" + msg;
    }

    return '<div class="ct-placed__row">' +
        '<input class="ct-placed__input" type="text" maxlength="30" data-voucher-input ' +
          'placeholder="Enter a code" aria-label="Voucher code" autocapitalize="characters" autocomplete="off"' +
          (voucherBusy ? " disabled" : "") + ">" +
        '<button class="ct-placed__save" type="button" data-voucher-apply' + (voucherBusy ? " disabled" : "") + ">" +
          (voucherBusy ? "Checking…" : "Apply") + "</button>" +
      "</div>" + msg;
  }

  function renderVoucher() {
    var box = view() && view().querySelector("[data-cart-voucher]");
    if (!box) return;
    var keep = box.querySelector("[data-voucher-input]");
    var typed = keep ? keep.value : "";
    box.innerHTML = voucherHtml();
    var input = box.querySelector("[data-voucher-input]");
    if (input && typed) input.value = typed;
  }

  function setVoucherMessage(text, ok) {
    voucherMessage = text ? { text: text, ok: !!ok } : null;
    renderVoucher();
  }

  function validateVoucherAt(code, stallId, subtotalCents) {
    return fetch(API + "/vouchers/validate", {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ code: code, stall_id: stallId, order_amount: subtotalCents / 100 }),
    }).then(function (r) {
      return r.text().then(function (t) {
        var parsed = null;
        try { parsed = t ? JSON.parse(t) : null; } catch (_) {}
        return { ok: r.ok, status: r.status, body: parsed };
      });
    });
  }

  function applyVoucher() {
    if (voucherBusy) return;
    var v = view(); if (!v) return;
    var input = v.querySelector("[data-voucher-input]");
    var code = input ? input.value.trim() : "";
    if (!code) { setVoucherMessage("Enter a voucher code.", false); if (input) input.focus(); return; }

    var candidates = B.groups().filter(function (g) {
      return g.storeRef && g.storeRef.stallId != null && !blockedReason(g);
    });
    if (!candidates.length) {
      setVoucherMessage("There is nothing in your cart a voucher can apply to yet.", false);
      return;
    }

    voucherBusy = true;
    renderVoucher();

    var index = 0;
    var lastMessage = null;

    function next() {
      if (index >= candidates.length) {
        voucherBusy = false;
        setVoucherMessage(lastMessage || "This code isn't valid for anything in your cart.", false);
        return;
      }
      var g = candidates[index++];
      validateVoucherAt(code, Number(g.storeRef.stallId), g.subtotal)
        .then(function (res) {
          var body = res.body || {};
          if (body.valid && body.data) {
            B.setVoucher({
              code: body.data.code,
              store: g.store,
              stallId: Number(g.storeRef.stallId),
              discountType: body.data.discount_type,
              discountValue: Number(body.data.discount_value),
            });
            voucherBusy = false;
            voucherMessage = null;
            renderAll();
            return;
          }
          if (body.message && body.message.indexOf("isn't valid at this stall") === -1) {
            lastMessage = body.message;
          }
          next();
        })
        .catch(function () {
          voucherBusy = false;
          setVoucherMessage("We couldn't check that code just now. Try again.", false);
        });
    }
    next();
  }

  function clearVoucher(message) {
    B.setVoucher(null);
    voucherMessage = message ? { text: message, ok: false } : null;
    renderAll();
  }

  /* ---------------- payment ---------------- */
  function walletHtml(m) {
    return '<button class="ct-wallet' + (m.brand ? " ct-wallet--brand" : "") + '" type="button" data-wallet="' + m.id + '">' +
      '<img class="ct-wallet__mark" src="../images/pay/' + esc(m.icon) + '" alt="">' +
      "<span>" + esc(m.label) + "</span></button>";
  }

  function cardHtml(m, selected) {
    var on = m.id === selected ? " is-selected" : "";
    return '<button class="ct-payrow' + on + '" type="button" role="radio" aria-checked="' + (!!on) +
      '" data-method="' + m.id + '">' +
      '<img class="ct-payrow__tile" src="../images/pay/' + esc(m.icon) + '" alt="">' +
      '<span class="ct-payrow__body">' +
        '<span class="ct-payrow__name">' + esc(m.label) + "</span>" +
        '<p class="ct-payrow__sub">' + esc(m.sub) + "</p>" +
      "</span>" +
      '<img class="ct-payrow__check" src="../images/check.svg" alt="">' +
      "</button>";
  }

  function renderMethods() {
    var box = view() && view().querySelector("[data-cart-methods]");
    if (!box) return;
    var list = global.hawkrPay.methods();
    var wallets = list.filter(function (m) { return m.kind === "wallet"; });
    var cards = list.filter(function (m) { return m.kind === "card"; });

    var sel = B.prefs().payment;
    if (sel && !cards.some(function (c) { return c.id === sel; })) { sel = null; B.setPref("payment", null); }
    if (!sel && cards.length) { sel = cards[0].id; B.setPref("payment", sel); }

    box.innerHTML =
      (wallets.length ? '<div class="ct-wallets">' + wallets.map(walletHtml).join("") + "</div>" : "") +
      (wallets.length && cards.length ? '<div class="ct-pay__divider"><span>or pay with a card</span></div>' : "") +
      (cards.length
        ? '<div class="ct-cards" role="radiogroup" aria-label="Saved cards">' +
            cards.map(function (c) { return cardHtml(c, sel); }).join("") + "</div>"
        : '<p class="ct-pay__empty">No saved card. Add one in Settings, or use a wallet above.</p>');
  }

  /* ---------------- totals ---------------- */
  function renderTotals() {
    var box = view() && view().querySelector("[data-cart-totals]");
    if (!box) return;
    var t = B.totals();
    var round = B.prefs().roundUp
      ? '<div class="ct-total ct-total--round">' +
          '<span class="ct-total__label">Rounding for <img class="ct-env__icon" src="../images/cart-humid.svg" alt="Hawkr Harvest"></span>' +
          '<span class="ct-total__value">' + M.format(t.roundUp) + "</span></div>"
      : "";
    var kinds = {};
    B.groups().forEach(function (g) {
      (g.discounts || []).forEach(function (d) { kinds[d.source] = true; });
    });
    var present = Object.keys(kinds);
    var SOLE_LABEL = {
      "centre-promotion": "Centre promotion",
      "vendor-promotion": "Stall promotion",
      voucher: "Voucher",
    };
    var promoLabel = present.length === 1 ? SOLE_LABEL[present[0]] : "Discounts";
    var promo = t.discount
      ? '<div class="ct-total ct-total--promo">' +
          '<span class="ct-total__label">' + promoLabel + "</span>" +
          '<span class="ct-total__value">−' + M.format(t.discount) + "</span></div>"
      : "";
    box.innerHTML =
      '<div class="ct-total"><span class="ct-total__label">Subtotal</span><span class="ct-total__value">' + M.format(t.subtotal) + "</span></div>" +
      promo +
      round +
      '<div class="ct-total"><span class="ct-total__label">Total</span><span class="ct-total__value">' + M.format(t.total) + "</span></div>";
    syncConfirm();
  }

  function closedStalls() {
    var C = global.hawkrCentre;
    if (!C) return [];
    return B.groups().filter(function (g) { return C.isClosed(g.store); }).map(function (g) { return g.store; });
  }

  function syncConfirm() {
    var btn = view() && view().querySelector("[data-cart-confirm]");
    if (!btn) return;
    var ok = B.lines().length > 0 && !!B.prefs().payment && closedStalls().length === 0 && !!realName();
    btn.classList.toggle("is-disabled", !ok);
    btn.disabled = !ok;
  }

  function syncEmpty() {
    var v = view(); if (!v) return;
    if (B.lines().length) v.removeAttribute("data-empty");
    else v.setAttribute("data-empty", "");
  }

  /* ---------------- prefs UI ---------------- */
  function syncPrefsUI() {
    var v = view(); if (!v) return;
    var p = B.prefs();
    v.querySelectorAll(".lg-toggle").forEach(function (t) {
      var input = t.querySelector("input[data-pref]");
      if (input) global.hawkrToggle.setState(t, !!p[input.dataset.pref]);
    });
    var seg = v.querySelector(".ct-seg");
    if (seg) {
      var mode = p.dineIn ? "dinein" : "dabao";
      seg.dataset.mode = mode;
      seg.querySelectorAll("[data-mode-set]").forEach(function (b) {
        b.setAttribute("aria-checked", String(b.dataset.modeSet === mode));
      });
    }
  }

  function renderAll() {
    renderGroups(); renderWho(); renderCentres(); renderVoucher(); renderMethods(); renderTotals(); syncEmpty();
  }

  global.hawkrCartRefresh = function () {
    if (doc.body.dataset.view === "cart") renderAll();
  };

  var API = "/api";
  var placing = false;
  var lastOrderId = null;   // a REAL order id, for the review prompt. Null when none stuck.

  function apiHeaders() {
    return global.hawkrSession
      ? global.hawkrSession.authHeaders()
      : { "Content-Type": "application/json" };
  }

  var PAYMENT_METHOD = {
    paynow: "paynow",
    applepay: "card",
    googlepay: "card",
    link: "card",
    grabpay: "card",
  };
  function paymentMethodFor(id) {
    var m = global.hawkrPay.methods().filter(function (x) { return x.id === id; })[0];
    if (m && m.kind === "card") return "card";
    return PAYMENT_METHOD[id] || "card";
  }

  /* ---- customer_phone: ^[0-9]{8,12}$ or null ---- */
  function normalisePhone(raw) {
    if (!raw) return null;
    var digits = String(raw).replace(/\D/g, "");
    if (digits.length === 10 && digits.indexOf("65") === 0) digits = digits.slice(2);
    return /^[0-9]{8,12}$/.test(digits) ? digits : null;
  }
  function customerPhone() {
    var pr = global.hawkrProfile && global.hawkrProfile.get();
    return normalisePhone(pr && pr.phone);
  }

  /* ---- special_instructions: the two order-wide prefs, in words ---- */
  function specialInstructions() {
    var p = B.prefs();
    return [p.dineIn ? "Dine-in" : "Dabao (takeaway)", p.cutlery ? "Cutlery please" : "No cutlery"]
      .join(" · ").slice(0, 500);
  }

  function blockedReason(g) {
    var s = g.storeRef;
    if (!s || s.stallId == null || s.hawkerId == null) {
      return g.store + " isn't linked to a stall on the server yet, so it can't take an order.";
    }
    if (g.lines.some(function (l) { return l.dish.menuId == null; })) {
      return "Some items from " + g.store + " were added before its menu loaded. Remove and re-add them.";
    }
    return null;
  }

  function orderBody(g, name, phone, method, roundUpCents) {
    var body = {
      stall_id: Number(g.storeRef.stallId),
      hawker_id: Number(g.storeRef.hawkerId),
      customer_name: name,
      customer_phone: phone,
      payment_method: method,
      special_instructions: specialInstructions(),
      items: g.lines.map(function (l) {
        var item = { menu_id: Number(l.dish.menuId), quantity: l.qty };
        if (l.remarks) item.special_requests = String(l.remarks).slice(0, 500);
        return item;
      }),
    };
    var v = B.voucherFor(g.store);
    if (v) body.voucher_code = v.code;
    if (roundUpCents > 0) body.round_up = Math.round(roundUpCents) / 100;
    return body;
  }

  function postOrder(body) {
    return fetch(API + "/orders", {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify(body),
    }).then(function (r) {
      return r.text().then(function (t) {
        var parsed = null;
        try { parsed = t ? JSON.parse(t) : null; } catch (_) {}
        return { ok: r.ok, status: r.status, body: parsed };
      });
    });
  }

  /* ---------------- confirm → order placed ---------------- */

  function placeOrder(method) {
    if (placing) return;
    var paying = method || B.prefs().payment;
    var groups = B.groups();
    if (!groups.length || !paying) return;
    if (closedStalls().length) return;
    var name = realName();
    if (!name) {
      var input = view().querySelector("[data-who-input]");
      if (input) { input.focus(); input.scrollIntoView({ block: "center", behavior: REDUCE ? "auto" : "smooth" }); }
      return;
    }

    var paid = global.hawkrPay.methods().filter(function (m) { return m.id === paying; })[0];
    var paidLabel = paid ? (paid.kind === "card" ? paid.sub : paid.label.replace(/^(Check Out|Pay) with /, "")) : "";

    var phone = customerPhone();
    var serverMethod = paymentMethodFor(paying);

    // Split before sending: a stall that cannot be ordered from is never asked.
    var ready = [], blocked = [];
    groups.forEach(function (g) {
      var why = blockedReason(g);
      if (why) blocked.push({ group: g, error: why }); else ready.push(g);
    });
    if (!ready.length) { showOutcome([], blocked, paidLabel); return; }

    placing = true;
    var btn = view().querySelector("[data-cart-confirm]");
    if (btn) btn.disabled = true;

    var cartRoundUp = B.totals().roundUp || 0;

    Promise.all(ready.map(function (g, i) {
      return postOrder(orderBody(g, name, phone, serverMethod, i === 0 ? cartRoundUp : 0))
        .then(function (res) {
          if (res.ok && res.body && res.body.data) return { group: g, order: res.body.data };
          var msg = res.body && (res.body.details || res.body.message);
          return { group: g, error: g.store + ": " + (msg || "the order was refused (" + res.status + ").") };
        })
        .catch(function () {
          return { group: g, error: "We couldn't reach " + g.store + ". Check your connection." };
        });
    })).then(function (results) {
      var placed = results.filter(function (r) { return r.order; });
      var failed = results.filter(function (r) { return r.error; });

      placed.forEach(function (r) {
        r.group.lines.forEach(function (l) { B.remove(l.id); });
      });

      var applied = B.voucher();
      if (applied && placed.some(function (r) { return r.group.store === applied.store; })) {
        B.setVoucher(null);
        voucherMessage = null;
      }

      var pr = global.hawkrProfile;
      if (pr && placed.length) pr.set({ orders: (pr.get().orders || 0) + placed.length });

      renderAll();
      showOutcome(placed, blocked.concat(failed), paidLabel);
    });
  }

  function showOutcome(placed, problems, paidLabel) {
    lastOrderId = null;
    var sheet = doc.getElementById("ct-placed");
    if (!sheet) { placing = false; return; }

    var title = sheet.querySelector("#ct-placed-title");
    var text = sheet.querySelector("[data-placed-text]");
    var who = sheet.querySelector(".ct-placed__who");

    if (who) who.hidden = true;
    var row = sheet.querySelector(".ct-placed__row");
    if (row) row.hidden = true;

    if (placed.length) {
      var stalls = placed.map(function (r) { return r.group.store; });
      var names = stalls.length > 1
        ? stalls.slice(0, -1).join(", ") + " and " + stalls[stalls.length - 1]
        : stalls[0];

      var chargedCents = placed.reduce(function (n, r) {
        return n + M.cents(r.order && r.order.total_amount);
      }, 0);

      var first = placed[0].order;
      lastOrderId = first && first.order_id != null ? first.order_id : null;

      if (title) title.textContent = placed.length > 1 ? "Orders placed" : "Order placed";
      text.textContent =
        names + (stalls.length > 1 ? " are" : " is") + " getting it ready. Collect in about 9 minutes — they'll hold it for 15." +
        (chargedCents ? " Charged " + M.format(chargedCents) + "." : "") +
        (paidLabel ? " Paid with " + paidLabel + "." : "") +
        (problems.length ? " " + problems.length + (problems.length > 1 ? " stalls" : " stall") + " could not be ordered from — that food is still in your cart." : "");
    } else {
      if (title) title.textContent = "Order not placed";
      text.textContent = problems.length
        ? problems.map(function (p) { return p.error; }).join(" ")
        : "Nothing could be ordered. Your cart has not been changed.";
    }

    global.openSheet(sheet);
    global.wireSheetGesture(sheet, function () { placing = false; });
  }

  /* ---------------- open ---------------- */
  function openCart() {
    renderAll();
    syncPrefsUI();
    if (typeof global.currentView === "function" && global.currentView() === "cart") return;
    history.pushState({ view: "cart" }, "", "#cart");
    var go = function () {
      if (typeof applyView === "function") applyView("cart");
      else doc.body.dataset.view = "cart";
    };
    if (doc.startViewTransition) { // mirrors openStore/openItem — `to-cart` routes the header morph
      doc.body.classList.add("to-cart");
      var cleanup = function () { doc.body.classList.remove("to-cart"); };
      doc.startViewTransition(go).finished.then(cleanup, cleanup);
    } else { go(); }
    var v = view(); if (v) v.scrollTop = 0;
  }
  global.openCart = openCart;

  /* ---------------- wiring ---------------- */
  doc.addEventListener("DOMContentLoaded", function () {
    var v = view();
    if (!v) return;

    global.hawkrToggle.initAll(v, null); // per-toggle handling is delegated below

    v.addEventListener("click", function (e) {
      if (e.target.closest("[data-cart-back]")) { history.back(); return; }
      if (e.target.closest("[data-menu]")) {
        var m = doc.querySelector('#view-store button[aria-label="Menu"], #view-home button[aria-label="Menu"]');
        if (m) m.click();
        return;
      }
      if (e.target.closest("[data-cart-browse]")) { if (typeof navigate === "function") navigate("home"); return; }
      if (e.target.closest("[data-cart-confirm]")) { placeOrder(); return; }

      if (e.target.closest("[data-who-edit]")) {
        var wrow = v.querySelector("[data-who-row]");
        if (wrow) { wrow.hidden = false; var wi = wrow.querySelector("[data-who-input]"); if (wi) { wi.focus(); wi.select(); } }
        return;
      }
      if (e.target.closest("[data-who-save]")) { saveWho(); return; }

      if (e.target.closest("[data-voucher-apply]")) { applyVoucher(); return; }
      if (e.target.closest("[data-voucher-clear]")) { clearVoucher(null); return; }

      var seg = e.target.closest("[data-mode-set]");
      if (seg) { B.setPref("dineIn", seg.dataset.modeSet === "dinein"); syncPrefsUI(); return; }

      var wallet = e.target.closest("[data-wallet]");
      if (wallet) { placeOrder(wallet.dataset.wallet); return; }

      var method = e.target.closest("[data-method]");
      if (method) { B.setPref("payment", method.dataset.method); renderMethods(); syncConfirm(); return; }

      var edit = e.target.closest("[data-edit]");
      if (edit) {
        var l = B.line(edit.dataset.edit);
        if (l && typeof global.openItem === "function") {
          global.openItem(l.dish, { lineId: l.id, qty: l.qty, selections: l.selections, remarks: l.remarks });
        }
        return;
      }

      var row = e.target.closest("[data-line]");
      if (!row) return;
      var id = row.dataset.line;
      var line = B.line(id);
      if (!line) return;
      if (e.target.closest(".qinc")) { B.setQty(id, line.qty + 1); patchLine(id); }
      else if (e.target.closest(".qdec")) {
        // − at 1 removes: that IS the Figma control, no invented bin icon
        if (line.qty <= 1) removeLine(id);
        else { B.setQty(id, line.qty - 1); patchLine(id); }
      }
    });

    v.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      if (e.target.closest("[data-who-input]")) { e.preventDefault(); saveWho(); return; }
      if (e.target.closest("[data-voucher-input]")) { e.preventDefault(); applyVoucher(); }
    });

    v.addEventListener("input", function (e) {
      if (!e.target.closest("[data-voucher-input]") || !voucherMessage) return;
      voucherMessage = null;
      var msg = v.querySelector(".ct-voucher__msg");
      if (msg) msg.remove();
    });

    v.addEventListener("change", function (e) {
      var input = e.target.closest("input[data-pref]");
      if (!input) return;
      B.setPref(input.dataset.pref, input.checked);
      if (input.dataset.pref === "roundUp") renderTotals();
    });

    // Settings can delete a card while we're not looking.
    if (global.hawkrCards) global.hawkrCards.onChange(function () {
      if (doc.body.dataset.view === "cart") { renderMethods(); syncConfirm(); }
    });

    // order-placed sheet
    var placed = doc.getElementById("ct-placed");
    if (placed) placed.addEventListener("click", function (e) {
      if (e.target.closest("[data-placed-rename]")) {
        placed.querySelector(".ct-placed__row").hidden = false;
        placed.querySelector(".ct-placed__input").focus();
        return;
      }
      if (e.target.closest("[data-placed-save]")) {
        var val = placed.querySelector(".ct-placed__input").value.trim();
        // the seam profile.js was written for and nothing had ever called
        if (val && global.hawkrProfile) global.hawkrProfile.promoteToName(val);
        placed.querySelector("[data-placed-name]").textContent = global.hawkrProfile.displayName();
        placed.querySelector(".ct-placed__row").hidden = true;
        return;
      }
      if (e.target.closest("[data-placed-done]") || e.target.closest("[data-placed-dismiss]")) {
        global.closeSheet(placed);
        placing = false;
        if (lastOrderId != null && ordersAsCustomer() && global.hawkrReviews) {
          global.hawkrReviews.open(lastOrderId);
          return;
        }
        if (typeof navigate === "function") navigate("home");
      }
    });

    autoHideBar(v, v.querySelector(".ct-bar"), "ct-bar--hidden", { hideAfter: 64 });

    function sync() {
      if (doc.body.dataset.view !== "cart") return;
      renderAll();
      syncPrefsUI();
      var bar = v.querySelector(".ct-bar");
      if (bar) bar.classList.remove("ct-bar--hidden"); // always arrive with the bar showing
    }
    new MutationObserver(sync).observe(doc.body, { attributes: true, attributeFilter: ["data-view"] });
    sync();
  });
})(window, document);
