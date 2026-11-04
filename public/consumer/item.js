/* item.js — the dish item-detail page. */
(function (global, doc) {
  "use strict";

  var REDUCE = matchMedia("(prefers-reduced-motion:reduce)").matches;
  function band(v, cap) { return cap * Math.tanh(v / cap); }

  var ALLERGENS = {};
  (global.HAWKR_ALLERGENS || []).forEach(function (a, i) { ALLERGENS[a.id] = { order: i, name: a.name, img: a.img, bg: a.bg }; });

  var DISCLAIMER = "Allergen information is disclosed by, and is the sole responsibility of, the stall. Hawkr displays it as provided and does not independently verify it. When in doubt, ask the stall directly.";

  var M = global.hawkrMoney; // money.js — parsing/formatting live there now, so the cart shares them
  function myAllergens() { var pr = global.hawkrProfile && hawkrProfile.get(); return (pr && pr.signedUp && pr.allergens) || []; }
  function threatIds(ids) { var mine = myAllergens(); return (ids || []).filter(function (x) { return mine.indexOf(x) > -1; }); }

  var cur = null, sel = {}, qty = 1;
  var editing = null; // set only when the cart's Edit chip opened us; { lineId, qty, selections, remarks }

  /* ---------------- render ---------------- */
  function groupHtml(g) {
    var reqBadge = g.type === "single" && g.required;
    var badge = g.type === "single" ? (g.required ? "Choose 1" : "Optional")
      : (g.max ? "Up to " + g.max : "Optional");
    var opts = g.options.map(function (o) {
      var input = '<input type="' + (g.type === "single" ? "radio" : "checkbox") + '" name="' + g.id +
        '" value="' + o.name + '" data-group="' + g.id + '">';
      var showPrice = g.type === "single" || (o.price > 0); // single shows +0.00; multi only when it costs
      return '<label class="item-opt"><span class="item-opt__ctrl">' + input +
        '<span class="item-opt__box"><img class="item-opt__check" src="../images/check.svg" alt=""></span></span>' +
        '<span class="item-opt__name">' + o.name + '</span>' +
        (showPrice ? '<span class="item-opt__price">' + M.plus(o.price) + "</span>" : "") + "</label>";
    }).join("");
    return '<div class="item-group" data-group-id="' + g.id + '" data-type="' + g.type + '" data-required="' + (g.required ? 1 : 0) +
      '" data-min="' + (g.min || 0) + '" data-max="' + (g.max || 0) + '">' +
      '<div class="item-group__head"><h3 class="item-group__ttl">' + g.title + '</h3>' +
      '<span class="item-badge' + (reqBadge ? " item-badge--req" : "") + '">' + badge + '</span></div>' +
      opts + "</div>";
  }

  function render(dish) {
    var scroll = doc.querySelector("#view-item .item-scroll");
    var foot = doc.querySelector("#view-item .item-foot");
    if (!scroll || !foot) return;
    var hits = threatIds(dish.allergens);

    var warn = hits.length ? '<div class="item-warn" role="alert"><span class="item-warn__mark">!</span>' +
      '<p><b>Contains ' + hits.map(function (id) { return ALLERGENS[id].name.toLowerCase(); }).join(" and ") +
      '</b> — allergens you told us about. Please order with intention.</p></div>' : "";

    var contains = (dish.allergens && dish.allergens.length) ? '<div class="item-contains"><p class="item-contains__ttl">This dish contains:</p>' +
      dish.allergens.map(function (id) {
        return '<div class="item-contains__row' + (hits.indexOf(id) > -1 ? " is-hit" : "") + '">' +
          '<span class="item-contains__disc" style="background:' + ALLERGENS[id].bg + '"><img src="../images/' + ALLERGENS[id].img + '" alt=""></span>' +
          '<span class="item-contains__name">' + ALLERGENS[id].name + "</span></div>";
      }).join("") +
      '<p class="item-disclaimer">' + DISCLAIMER + "</p></div>" : "";

    var groups = (dish.customisations || []).map(groupHtml).join("");
    var remarks = '<div class="item-group"><div class="item-group__head"><h3 class="item-group__ttl">Remarks</h3>' +
      '<span class="item-badge">Optional</span></div>' +
      '<textarea class="item-remarks" rows="3" placeholder="Anything we should know? Less spicy, no onions…"></textarea></div>';

    scroll.innerHTML =
      '<header class="item-bar">' +
        '<div class="item-bar__frost frost" aria-hidden="true"></div>' +
        '<div class="dual-btn item-dual-left" data-liquid-glass="drag" role="group" aria-label="Back and menu">' +
          '<button class="dual-btn__side" type="button" data-item-back aria-label="Back"><img class="dual-btn__icon" src="../images/dual-back.svg" alt=""></button>' +
          '<button class="dual-btn__side" type="button" data-menu aria-label="Menu"><img class="dual-btn__icon" src="../images/dual-panel.svg" alt=""></button>' +
        "</div>" +
        '<button class="item-heart" type="button" data-liquid-glass="drag" data-fav-heart aria-label="Favourites"><img class="dual-btn__icon" src="../images/dual-heart.svg" alt=""></button>' +
      "</header>" +
      (dish.img ? '<div class="item-hero"><img class="item-hero__img" src="' + dish.img + '" alt="' + dish.name + '"' + (window.hawkrImgFallbackAttr ? window.hawkrImgFallbackAttr(dish) : "") + '></div>' : "") +
      '<div class="item-main">' +
        '<div class="item-head"><div class="item-head__main"><h1 class="item-name">' + dish.name + "</h1>" +
          (dish.desc ? '<p class="item-desc">' + dish.desc + "</p>" : "") +
        "</div>" +
        '<span class="item-price">' +
          (dish.was ? '<s class="item-price__was">' + dish.was + "</s> " : "") +
          dish.price +
        "</span></div>" +
        warn + contains + groups + remarks +
      "</div>";

    foot.innerHTML =
      '<div class="item-foot__frost frost" aria-hidden="true"></div>' +
      '<button class="item-add" type="button" data-item-add data-liquid-glass="drag">' +
        '<svg class="item-add__icon" width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1V13M1 7H13" stroke="#fffafa" stroke-width="2" stroke-linecap="round"/></svg>' +
        '<span class="item-add__label">Add to basket</span><span class="item-add__price"></span></button>' +
      '<div class="qstep">' +
        '<div class="qstep__count" data-liquid-glass role="spinbutton" aria-valuemin="1" aria-valuenow="1" aria-label="Quantity"><span class="qstep__num">1</span></div>' +
        '<div class="qstep__pill" data-liquid-glass>' +
          '<button class="qstep__btn qdec" type="button" aria-label="Decrease quantity"><svg width="14" height="2" viewBox="0 0 14 2" fill="none" aria-hidden="true"><path d="M1 1H13" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round"/></svg></button>' +
          '<span class="qstep__sep"></span>' +
          '<button class="qstep__btn qinc" type="button" aria-label="Increase quantity"><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1V13M1 7H13" stroke="#1d1d1f" stroke-width="2" stroke-linecap="round"/></svg></button>' +
        "</div>" +
      "</div>";

    if (typeof initLiquidGlass === "function") initLiquidGlass(doc.getElementById("view-item"));
    wireStepper();
    applyEdit(); // must sit between wireStepper() and update() — see below
    update();
    // render() rebuilds .item-heart, so its filled state has to be re-applied
    if (typeof global.syncFavouriteHearts === "function") global.syncFavouriteHearts();
  }

  function applyEdit() {
    if (!editing) return;
    var v = doc.getElementById("view-item");
    Object.keys(editing.selections || {}).forEach(function (gid) {
      (editing.selections[gid] || []).forEach(function (name) {
        var inp = v.querySelector('input[data-group="' + gid + '"][value="' + name.replace(/"/g, '\\"') + '"]');
        if (!inp) return;
        inp.checked = true;
        inp.closest(".item-opt").classList.add("is-selected"); // what the change handler does
      });
    });
    var rem = v.querySelector(".item-remarks");
    if (rem && editing.remarks) rem.value = editing.remarks;
    var num = v.querySelector(".qstep__num"), count = v.querySelector(".qstep__count");
    if (num) num.textContent = qty;
    if (count) count.setAttribute("aria-valuenow", qty);
    var label = v.querySelector(".item-add__label");
    if (label) label.textContent = "Update basket"; // INVENTED copy — no Figma edit state
  }

  /* ---------------- selection state + price + gating ---------------- */
  function readSel() {
    sel = {};
    doc.querySelectorAll("#view-item .item-group[data-group-id]").forEach(function (gEl) {
      var id = gEl.dataset.groupId;
      sel[id] = [].map.call(gEl.querySelectorAll("input:checked"), function (c) { return c.value; });
    });
  }
  function update() {
    if (!cur) return;
    readSel();
    var unit = global.hawkrBag.unitCents(cur, sel);
    if (cur.was) unit -= Math.max(0, M.cents(cur.was) - M.cents(cur.price));
    var total = unit * qty;
    var addBtn = doc.querySelector("#view-item .item-add");
    if (!addBtn) return;
    addBtn.querySelector(".item-add__price").textContent = M.format(total);
    var ok = (cur.customisations || []).every(function (g) {
      var n = (sel[g.id] || []).length;
      if (g.type === "single" && g.required) return n >= 1;
      if (g.type === "multi") { if (g.min && n < g.min) return false; if (g.max && n > g.max) return false; return true; }
      return true;
    });
    var closed = !editing && !!(global.hawkrCentre && typeof global.currentStoreName === "function" &&
      global.hawkrCentre.isClosed(global.currentStoreName()));
    if (closed) {
      var lbl = addBtn.querySelector(".item-add__label");
      if (lbl) lbl.textContent = "Centre closed";
    }
    addBtn.classList.toggle("is-disabled", !ok || closed);
    addBtn.disabled = !ok || closed;
  }

  /* ---------------- quantity stepper (−/+ only; count is a display, not draggable) ---------------- */
  function wireStepper() {
    var view = doc.getElementById("view-item");
    var numEl = view.querySelector(".qstep__num");
    var countEl = view.querySelector(".qstep__count");
    function setQty(n) { qty = Math.max(1, Math.min(99, n)); numEl.textContent = qty; if (countEl) countEl.setAttribute("aria-valuenow", qty); update(); }
    view.querySelector(".qdec").addEventListener("click", function () { setQty(qty - 1); });
    view.querySelector(".qinc").addEventListener("click", function () { setQty(qty + 1); });
  }

  /* ---------------- add-to-basket (optimistic + flight into the FAB) ---------------- */
  function fabBox() {
    var el = doc.querySelector(".cart-fab");
    if (!el) return null;
    var r = el.getBoundingClientRect();
    var w = el.offsetWidth || 48, h = el.offsetHeight || 48;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    return { left: cx - w / 2, top: cy - h / 2, width: w, height: h };
  }

  function addFlight() {
    var rem = doc.querySelector("#view-item .item-remarks");

    if (editing) {
      global.hawkrBag.update(editing.lineId, { qty: qty, selections: sel, remarks: rem && rem.value });
      editing = null;
      history.back();
      return;
    }

    global.hawkrBag.add(cur, { qty: qty, selections: sel, remarks: rem && rem.value });

    var navigated = false;
    function goStore() { if (navigated) return; navigated = true; history.back(); } // → popstate view-transitions to store
    function bumpFab() { var f = doc.querySelector(".cart-fab"); if (!f) return; f.classList.remove("cart-fab--bump"); void f.offsetWidth; f.classList.add("cart-fab--bump"); }

    var addBtn = doc.querySelector("#view-item .item-add");
    var f = fabBox();
    if (REDUCE || !addBtn || !f) { goStore(); return; }

    var a = addBtn.getBoundingClientRect();
    var fly = doc.createElement("div");
    fly.className = "item-fly";
    fly.innerHTML = '<svg class="item-fly__icon" width="20" height="20" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 1V13M1 7H13" stroke="#fffafa" stroke-width="2" stroke-linecap="round"/></svg>';
    fly.style.left = a.left + "px"; fly.style.top = a.top + "px";
    fly.style.width = a.width + "px"; fly.style.height = a.height + "px";
    fly.style.borderRadius = "22px";
    doc.body.appendChild(fly);
    addBtn.style.visibility = "hidden";

    requestAnimationFrame(function () {
      fly.style.left = f.left + "px"; fly.style.top = f.top + "px";
      fly.style.width = f.width + "px"; fly.style.height = f.height + "px";
      fly.style.borderRadius = "8px"; // rounded-rect → the FAB's rx-8 tile
    });
    setTimeout(function () {
      fly.style.opacity = "0";
      goStore();                    // store view slides in; the FAB is already there (bag updated)…
      requestAnimationFrame(bumpFab); // …so bump it to react as the tile merges in
      setTimeout(function () { if (fly.parentNode) fly.parentNode.removeChild(fly); }, 240);
    }, 440);
    setTimeout(goStore, 900); // safety if rAF/the flight stalls (backgrounded tab)
  }

  /* ---------------- open ---------------- */
  function openItem(dish, edit) {
    if (!dish) return;
    editing = edit || null; // reset on every open, so a plain tap is never in edit mode
    cur = dish; sel = {}; qty = (edit && edit.qty) || 1;
    render(dish);
    var go = function () { if (typeof applyView === "function") applyView("item"); else doc.body.dataset.view = "item"; };
    history.pushState({ view: "item" }, "", "#item");
    if (doc.startViewTransition) { // `to-item` routes the header morph (mirrors openStore's to-store)
      doc.body.classList.add("to-item");
      var cleanup = function () { doc.body.classList.remove("to-item"); };
      doc.startViewTransition(go).finished.then(cleanup, cleanup);
    } else { go(); }
    var sc = doc.querySelector("#view-item .item-scroll"); if (sc) sc.scrollTop = 0;
  }
  global.openItem = openItem;
  global.currentDish = function () { return cur; }; // favourites-page.js hearts the real dish, not a DOM scrape

  /* ---------------- delegated wiring (container is stable) ---------------- */
  doc.addEventListener("DOMContentLoaded", function () {
    var view = doc.getElementById("view-item");
    if (!view) return;
    view.addEventListener("change", function (e) {
      var inp = e.target.closest("input[data-group]");
      if (!inp) return;
      var gEl = inp.closest(".item-group");
      if (inp.type === "radio") gEl.querySelectorAll(".item-opt").forEach(function (l) { l.classList.remove("is-selected"); });
      if (inp.type === "checkbox") {
        var max = +gEl.dataset.max;
        if (max && gEl.querySelectorAll("input:checked").length > max) { inp.checked = false; return; } // enforce max
      }
      inp.closest(".item-opt").classList.toggle("is-selected", inp.checked);
      update();
    });
    view.addEventListener("click", function (e) {
      if (e.target.closest("[data-item-back]")) { history.back(); return; }
      if (e.target.closest("[data-menu]")) { // open the drawer via a sidebar-wired menu button
        var m = document.querySelector('#view-store button[aria-label="Menu"], #view-home button[aria-label="Menu"]');
        if (m) m.click();
        return;
      }
      var add = e.target.closest("[data-item-add]");
      if (add && !add.disabled) addFlight();
    });

    var sc = view.querySelector(".item-scroll");
    // pass the SELECTOR, not the element: render() rebuilds .item-bar for every dish
    if (sc && typeof autoHideBar === "function") autoHideBar(sc, ".item-bar", "item-bar--hidden");
  });
})(window, document);
