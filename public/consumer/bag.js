(function (global) {
  "use strict";

  var KEY = "hawkr:cart";
  var VERSION = 2;
  var M = global.hawkrMoney;

  var lines = [];
  var seq = 0;
  var prefs = { dineIn: true, roundUp: true, cutlery: false, payment: null };
  var subs = [];

  function findStore(name) { // mirrors store.js findStore — STORES is a home.js top-level const
    return (typeof STORES !== "undefined" ? STORES : []).filter(function (s) { return s.name === name; })[0] || null;
  }

  /* ---------------- pricing ---------------- */
  function unitCents(dish, selections) {
    if (!dish) return 0;
    var c = M.cents(dish.was || dish.price);
    (dish.customisations || []).forEach(function (g) {
      ((selections && selections[g.id]) || []).forEach(function (name) {
        var o = g.options.filter(function (x) { return x.name === name; })[0];
        if (o && o.price) c += M.cents(o.price);
      });
    });
    return c;
  }

  /* ---------------- line identity ---------------- */
  function normSel(selections) {
    var out = {};
    Object.keys(selections || {}).forEach(function (k) {
      var v = (selections[k] || []).slice().sort(); // copy: never mutate the caller's arrays
      if (v.length) out[k] = v;
    });
    return out;
  }
  function sig(store, dishName, selections, remarks) {
    var s = normSel(selections);
    return [store, dishName,
      Object.keys(s).sort().map(function (k) { return k + ":" + s[k].join(","); }).join("|"),
      remarks || ""].join("");
  }
  function lineSig(l) { return sig(l.store, l.dish.name, l.selections, l.remarks); }

  function snapshot(dish) {
    return {
      name: dish.name, price: dish.price, img: dish.img,
      desc: dish.desc || null,
      menuId: dish.menuId != null ? dish.menuId : null,
      category: dish.category || null,
      allergens: dish.allergens || null,
      customisations: dish.customisations || null
    };
  }

  /* ---------------- persistence ---------------- */
  function save() {
    try {
      if (global.localStorage) localStorage.setItem(KEY, JSON.stringify({ v: VERSION, lines: lines, prefs: prefs }));
    } catch (_) {} // quota/private mode → stay in memory rather than throw mid-checkout
  }
  function validLine(l) {
    return l && typeof l === "object" && l.dish && typeof l.dish.name === "string" &&
      typeof l.store === "string" && typeof l.unit === "number" && typeof l.qty === "number" && l.qty > 0;
  }
  function load() {
    try {
      var raw = global.localStorage && localStorage.getItem(KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (!s || s.v !== VERSION) return; // shape changed → discard wholesale, don't guess
      // Per-line validation drops a bad line individually and keeps the rest.
      lines = (s.lines || []).filter(validLine);
      lines.forEach(function (l) {
        l.selections = normSel(l.selections);
        var n = parseInt(String(l.id).replace(/\D/g, ""), 10);
        if (n >= seq) seq = n + 1; // never re-mint an id already in the restored cart
      });
      if (s.prefs) for (var k in prefs) { if (s.prefs.hasOwnProperty(k)) prefs[k] = s.prefs[k]; }
    } catch (_) { lines = []; }
  }

  function emit() { save(); subs.forEach(function (fn) { try { fn(); } catch (_) {} }); }

  /* ---------------- mutations ---------------- */
  function add(dish, opts) {
    if (!dish) return null;
    var o = opts || {};
    var store = o.store || (typeof global.currentStoreName === "function" ? global.currentStoreName() : null);
    if (!store) return null; // a line with no stall can't be grouped, priced or collected

    if (global.hawkrCentre && global.hawkrCentre.isClosed(store)) {
      return { line: null, merged: false, blocked: "centre-closed", store: store };
    }
    var selections = normSel(o.selections);
    var remarks = (o.remarks && String(o.remarks).trim()) || null;
    var qty = Math.max(1, Math.min(99, parseInt(o.qty, 10) || 1));

    var s = sig(store, dish.name, selections, remarks);
    var hit = lines.filter(function (l) { return lineSig(l) === s; })[0];
    if (hit) {
      hit.qty = Math.min(99, hit.qty + qty);
      emit();
      return { line: hit, merged: true };
    }
    var line = {
      id: "ln" + (seq++), store: store, dish: snapshot(dish),
      unit: unitCents(dish, selections), qty: qty, selections: selections
    };
    if (remarks) line.remarks = remarks;
    lines.push(line);
    emit();
    return { line: line, merged: false };
  }

  function byId(id) { return lines.filter(function (l) { return l.id === id; })[0] || null; }

  function update(id, patch) {
    var l = byId(id);
    if (!l || !patch) return null;
    if (patch.selections) l.selections = normSel(patch.selections);
    if (patch.hasOwnProperty("remarks")) {
      var r = (patch.remarks && String(patch.remarks).trim()) || null;
      if (r) l.remarks = r; else delete l.remarks;
    }
    if (patch.qty != null) l.qty = Math.max(1, Math.min(99, parseInt(patch.qty, 10) || 1));
    l.unit = unitCents(l.dish, l.selections);
    emit();
    return l;
  }

  function remove(id) {
    var i = lines.map(function (l) { return l.id; }).indexOf(id);
    if (i < 0) return false;
    lines.splice(i, 1);
    emit();
    return true;
  }

  function setQty(id, n) {
    if (n <= 0) return remove(id); // the stepper's − at 1 is the remove affordance
    var l = byId(id);
    if (!l) return false;
    l.qty = Math.min(99, n);
    emit();
    return true;
  }

  function clear() { lines = []; prefs.payment = null; voucher = null; emit(); }

  /* ---------------- the voucher ---------------- */
  var voucher = null;

  function setVoucher(v) {
    voucher = v || null;
    emit();
  }

  function currentVoucher() {
    if (!voucher) return null;
    var stillHere = lines.some(function (l) { return l.store === voucher.store; });
    if (!stillHere) { voucher = null; return null; }
    return voucher;
  }

  function voucherFor(store) {
    var v = currentVoucher();
    return v && v.store === store ? v : null;
  }

  /* ---------------- reads ---------------- */
  function stallPricing(store, groupLines) {
    var empty = { promotion: null, discount: 0, discounts: [] };
    if (!global.hawkrCentre || !groupLines || !groupLines.length) return empty;
    var priced = global.hawkrCentre.priceStall(store, groupLines.map(function (l) {
      return { unit: l.unit, qty: l.qty, menuId: l.dish.menuId, category: l.dish.category };
    }), voucherFor(store));
    return {
      promotion: global.hawkrCentre.promotionFor(store),
      discount: priced.discountCents,
      discounts: priced.discounts
    };
  }

  function groups() {
    var out = [], by = {};
    lines.forEach(function (l) {
      var g = by[l.store];
      if (!g) { g = by[l.store] = { store: l.store, storeRef: findStore(l.store), lines: [], subtotal: 0 }; out.push(g); }
      g.lines.push(l);
      g.subtotal += l.unit * l.qty;
    });
    out.forEach(function (g) {
      var d = stallPricing(g.store, g.lines);
      g.promotion = d.promotion;   // the CentrePromotion row, kept for callers that ask
      g.discount = d.discount;     // cents off THIS stall's subtotal, BOTH sources together
      g.discounts = d.discounts;
    });
    return out; // first-added order — a stall doesn't jump the list when you add to it
  }

  function count() { return lines.reduce(function (n, l) { return n + l.qty; }, 0); }
  function countFor(store) {
    return lines.reduce(function (n, l) { return l.store === store ? n + l.qty : n; }, 0);
  }

  function totals() {
    var subtotal = lines.reduce(function (n, l) { return n + l.unit * l.qty; }, 0);
    var discount = groups().reduce(function (n, g) { return n + (g.discount || 0); }, 0);
    var discounted = Math.max(0, subtotal - discount);
    var roundUp = prefs.roundUp ? M.roundUpDelta(discounted) : 0;
    return {
      subtotal: subtotal,
      discount: discount,
      roundUp: roundUp,
      total: discounted + roundUp,
    };
  }

  function setPref(k, v) {
    if (!prefs.hasOwnProperty(k)) return;
    prefs[k] = v;
    emit();
  }

  load();

  global.hawkrBag = {
    unitCents: unitCents,
    add: add, update: update, remove: remove, setQty: setQty, clear: clear,
    line: byId,
    lines: function () { return lines.slice(); },
    groups: groups, count: count, countFor: countFor, totals: totals,
    setVoucher: setVoucher, voucher: currentVoucher, voucherFor: voucherFor,
    prefs: function () { return prefs; }, setPref: setPref,
    onChange: function (fn) { if (typeof fn === "function") subs.push(fn); }
  };

  global.addToBag = function (item) {
    if (!item) return null;
    return add(item, { qty: item.qty, selections: item.selections, remarks: item.remarks });
  };
})(window);
