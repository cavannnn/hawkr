/* favourites-page.js — #view-favourites (Figma 141:1244, empty state 143:1594). */
(function (global, doc) {
  "use strict";

  var F = global.hawkrFavourites;

  function view() { return doc.getElementById("view-favourites"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  }); }

  function currentTab() {
    var v = view();
    return (v && v.querySelector(".fv-seg").dataset.tab) || "stalls";
  }

  function findStore(name) {
    return (typeof STORES !== "undefined" ? STORES : []).filter(function (s) { return s.name === name; })[0] || null;
  }

  function dishCardHtml(d) {
    var card = typeof global.dishCardHtml === "function" ? global.dishCardHtml(d) : "";
    return '<div class="fv-card" data-fav-dish="' + esc(d.name) + '" data-fav-store="' + esc(d.store) + '">' +
      card + "</div>";
  }

  function stallHeadHtml(storeName) {
    var s = findStore(storeName);
    return '<div class="fv-stall ct-stall">' +
      (s ? '<img class="ct-stall__thumb" src="' + esc(s.img) + '" alt=""' + (window.hawkrImgFallbackAttr ? window.hawkrImgFallbackAttr(s) : "") + '>' : "") +
      "<span>" +
        '<h2 class="ct-stall__name">' + esc(storeName) + "</h2>" +
        (s ? '<span class="ct-stall__sub"><span class="ct-stall__at">@ ' + esc(s.location) + "</span></span>" : "") +
      "</span></div>";
  }

  function dishesHtml() {
    var byStall = [], seen = {};
    F.dishes().forEach(function (d) {
      if (!seen[d.store]) { seen[d.store] = { store: d.store, items: [] }; byStall.push(seen[d.store]); }
      seen[d.store].items.push(d);
    });
    return byStall.map(function (g) {
      return stallHeadHtml(g.store) +
        '<div class="fv-cards">' + g.items.map(dishCardHtml).join("") + "</div>";
    }).join("");
  }

  function renderStatus() {
    var el = view() && view().querySelector("[data-fav-status]");
    if (!el) return;
    var s = F.status();
    el.textContent = s ? s.text : "";
    el.hidden = !s;
    el.className = "pref-status fv-status" + (s ? " pref-status--" + s.tone : "");
  }

  function render() {
    var v = view();
    if (!v) return;
    var list = v.querySelector("[data-fav-list]");
    var empty = v.querySelector(".fv-empty");
    var end = v.querySelector(".fv-end");
    var tab = currentTab();
    var html = "";

    renderStatus();

    if (tab === "stalls") {
      // resolve names → STORES records; a stall that's vanished from the data is skipped
      var stores = F.stalls().map(findStore).filter(Boolean);
      html = stores.map(function (s) { return storeCardTemplate(s); }).join("");
    } else {
      html = dishesHtml();
    }

    list.innerHTML = html;
    var isEmpty = !html;
    empty.hidden = !isEmpty;
    end.hidden = isEmpty;
    if (typeof global.initLiquidGlass === "function") global.initLiquidGlass(list);
  }

  function setTab(tab) {
    var v = view();
    if (!v) return;
    v.querySelector(".fv-seg").dataset.tab = tab;
    v.querySelectorAll("[data-fav-tab]").forEach(function (b) {
      b.setAttribute("aria-checked", String(b.dataset.favTab === tab));
    });
    render();
  }

  var HEART_ON = "../images/heart-filled.svg";
  function paintHeart(el, on, offSrc) {
    if (!el) return;
    var img = el.querySelector("img");
    if (img) img.src = on ? HEART_ON : offSrc;
    el.classList.toggle("is-fav", !!on);
  }

  function syncHearts() {
    var v = doc.body.dataset.view;
    if (v === "store") {
      var sh = doc.querySelector("#view-store [data-fav-heart]");
      var sn = typeof global.currentStoreName === "function" && global.currentStoreName();
      paintHeart(sh, !!sn && F.isStall(sn), "../images/dual-heart.svg");
    } else if (v === "item") {
      var ih = doc.querySelector("#view-item .item-heart");
      var d = typeof global.currentDish === "function" && global.currentDish();
      var st = typeof global.currentStoreName === "function" && global.currentStoreName();
      paintHeart(ih, !!(d && st) && F.isDish(st, d.name), "../images/dual-heart.svg");
    }
  }
  global.syncFavouriteHearts = syncHearts; // item.js/store.js call this after re-rendering their header

  var cameFrom = null;

  function openFavourites() {
    setTab("stalls"); // always arrive on Stalls (it renders); both Figma frames show it selected
    if (typeof global.currentView === "function" && global.currentView() === "favourites") return;
    cameFrom = doc.body.dataset.view || null;
    history.pushState({ view: "favourites" }, "", "#favourites");
    var go = function () {
      if (typeof applyView === "function") applyView("favourites");
      else doc.body.dataset.view = "favourites";
    };
    if (doc.startViewTransition) {
      doc.body.classList.add("to-favourites");
      var cleanup = function () { doc.body.classList.remove("to-favourites"); };
      doc.startViewTransition(go).finished.then(cleanup, cleanup);
    } else { go(); }
    var v = view(); if (v) v.scrollTop = 0;
  }
  global.openFavourites = openFavourites;

  function closeFavourites() {
    if (cameFrom) { cameFrom = null; history.back(); }
    else if (typeof navigate === "function") navigate("home");
  }

  doc.addEventListener("DOMContentLoaded", function () {
    var v = view();
    if (!v) return;

    v.addEventListener("click", function (e) {
      if (e.target.closest("[data-fav-back]")) { history.back(); return; }
      if (e.target.closest("[data-menu]")) {
        var m = doc.querySelector('#view-store button[aria-label="Menu"], #view-home button[aria-label="Menu"]');
        if (m) m.click();
        return;
      }
      var tab = e.target.closest("[data-fav-tab]");
      if (tab) { setTab(tab.dataset.favTab); return; }

      var dish = e.target.closest("[data-fav-dish]");
      if (dish) {
        var full = typeof global.findDish === "function" &&
                   global.findDish(dish.dataset.favStore, dish.dataset.favDish);
        if (full && typeof global.openItem === "function") global.openItem(full);
        return;
      }
    });

    /* ---- hearts, app-wide ---- */
    doc.addEventListener("click", function (e) {
      var heart = e.target.closest("[data-fav-heart]");
      if (!heart) return;
      var v = doc.body.dataset.view;

      if (v === "store") {
        var name = typeof global.currentStoreName === "function" && global.currentStoreName();
        if (name) { F.toggleStall(name); syncHearts(); }
        return;
      }
      if (v === "item") {
        var dish = typeof global.currentDish === "function" && global.currentDish();
        var store = typeof global.currentStoreName === "function" && global.currentStoreName();
        if (dish && store) { F.toggleDish(store, dish); syncHearts(); }
        return;
      }
      if (v === "favourites") { closeFavourites(); return; }
      openFavourites();
    });

    F.onChange(function () {
      if (doc.body.dataset.view === "favourites") render();
      else renderStatus();   // keep the line right even when the page is not the one showing
      syncHearts();
    });

    F.sync();
    autoHideBar(v, v.querySelector(".fv-bar"), "fv-bar--hidden", { hideAfter: 64 });

    function sync() {
      var onFav = doc.body.dataset.view === "favourites";
      syncHearts();
      if (!onFav) { cameFrom = null; return; }
      render();
      F.sync();
      var bar = v.querySelector(".fv-bar");
      if (bar) bar.classList.remove("fv-bar--hidden");
    }
    new MutationObserver(sync).observe(doc.body, { attributes: true, attributeFilter: ["data-view"] });
    sync();
  });
})(window, document);
