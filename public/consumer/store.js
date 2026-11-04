(function () {
  "use strict";

  function haversineKm(a, b) {
    var R = 6371, tr = Math.PI / 180;
    var dLat = (b.lat - a.lat) * tr, dLng = (b.lng - a.lng) * tr;
    var h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * tr) * Math.cos(b.lat * tr) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function userCoords() {
    var s = (typeof loadSaved === "function") ? loadSaved() : null;
    return (s && s.lat != null && s.lng != null) ? { lat: s.lat, lng: s.lng } : null;
  }
  function distanceLabel(store) {
    var u = userCoords();
    if (!u || !store.coords) return ""; // no location or no store coords → show nothing (not a fake)
    var km = haversineKm(u, store.coords);
    return km < 1 ? Math.round(km * 1000) + "m" : km.toFixed(1) + "km";
  }
  function findStore(name) {
    return (typeof STORES !== "undefined" ? STORES : []).find(function (s) { return s.name === name; });
  }

  /* ---------------- Menu data (placeholder for the shared template) ---------------- */
  var ALLERGENS = {};
  (window.HAWKR_ALLERGENS || []).forEach(function (a, i) {
    ALLERGENS[a.id] = { order: i, bg: a.bg, img: a.img, name: a.name };
  });
  var DEFAULT_DISHES = [
    { name: "Signature Plate", price: "$9.50", img: "beef-goulash.png" },
    { name: "House Special", price: "$8.00", img: "redhill-prawn-noodle.png" },
    { name: "Chef's Pick", price: "$10.00", img: "northern-thai.png" },
  ];
  function storeDishes(store) {
    return (typeof DISHES !== "undefined" && DISHES[store.name]) ? DISHES[store.name] : DEFAULT_DISHES;
  }

  /* ---------------- Templates ---------------- */
  function allergenStack(ids) {
    if (!ids || !ids.length) return "";
    var uniq = ids.filter(function (id, i) { return ALLERGENS[id] && ids.indexOf(id) === i; });
    uniq.sort(function (a, b) { return ALLERGENS[a].order - ALLERGENS[b].order; }); // canonical, not input order
    var chips = uniq.map(function (id, i) {
      return '<span class="allergen-chip" style="background:' + ALLERGENS[id].bg + ";z-index:" + (uniq.length - i) + '">' +
        '<img src="../images/' + ALLERGENS[id].img + '" alt="' + ALLERGENS[id].name + '"></span>';
    }).join("");
    return '<span class="allergens"><span class="allergens__label">Contains</span>' +
      '<span class="allergens__chips">' + chips + "</span></span>";
  }
  // ---- item registry: a card/row tap passes the full dish object to item.js openItem() ----
  var ITEM_INDEX = {}, itemSeq = 0;
  function regItem(d) { var id = "it" + (itemSeq++); var copy = Object.assign({ _id: id }, d); ITEM_INDEX[id] = copy; return copy; }

  // ---- per-user allergen threat: a signed-in user's saved allergens ∩ this dish's ----
  function myAllergens() { var p = window.hawkrProfile && hawkrProfile.get(); return (p && p.signedUp && p.allergens) || []; }
  function threatIds(ids) { var mine = myAllergens(); return (ids || []).filter(function (x) { return mine.indexOf(x) > -1; }); }

  // ---- demo dish enrichment (until a backend supplies desc/customisations) ----
  var DEMO_DESC = "Description of the dish that says it's really nice and savoury. Lorem ipsum dolor. Description of the dish that says it's really nice and savoury, lorem ipsum dolor.";
  var DEMO_CUSTOM = [
    { id: "set", title: "Make it a set", type: "single", required: true,
      options: [{ name: "Yes", price: 2.00 }, { name: "No", price: 0 }] },
    { id: "veg", title: "Add vegetables", type: "multi", required: false, min: 0, max: 2,
      options: [{ name: "Broccoli", price: 0 }, { name: "Carrot", price: 0 }] }
  ];

  function priceHtml(d) {
    return (d.was ? '<s class="p-dish__was">' + d.was + "</s> " : "") +
      '<span class="p-dish__price">' + d.price + "</span>";
  }

  function dishCard(d) {
    var badge = d.badge ? '<span class="p-badge p-badge--' + d.badge.tone + '">' + d.badge.text + "</span>" : "";
    var add = d.add ? '<button class="p-add" data-liquid-glass type="button" aria-label="Add ' + d.name + '"' +
      ' data-add data-name="' + d.name + '" data-price="' + d.price + '" data-img="' + d.img + '">' +
      '<img class="p-add__icon" src="../images/plus.svg" alt=""></button>' : "";
    var foot = priceHtml(d) + (d.allergens ? allergenStack(d.allergens) : "");
    var hits = threatIds(d.allergens);
    var flag = hits.length ? '<span class="p-flag"><img src="../images/' + ALLERGENS[hits[0]].img + '" alt=""><span>' + ALLERGENS[hits[0]].name + "</span></span>" : "";
    var photo = d.img ? '<img class="p-dish__photo" src="' + d.img + '" alt="' + d.name + '"' + (window.hawkrImgFallbackAttr ? window.hawkrImgFallbackAttr(d) : "") + '>' : "";
    return '<article class="p-dish' + (hits.length ? " p-dish--allergen" : "") + '"' + (d._id ? ' data-item="' + d._id + '"' : "") + ">" +
      '<div class="p-dish__media">' + photo + badge + flag + add + "</div>" +
      '<p class="p-dish__name">' + d.name + "</p>" +
      '<div class="p-dish__foot">' + foot + "</div>" +
    "</article>";
  }
  function section(title, dishes) {
    return '<section class="p-section"><h2 class="p-section__title">' + title + "</h2>" +
      '<div class="p-carousel">' + dishes.map(dishCard).join("") + "</div></section>";
  }

  /* ---------------- Reviews (placeholder for the shared template) ---------------- */
  var REVIEWS = [
    { name: "Balakrishnan s/o Sambasivam", text: "Food served hot and the packaging was thoughtful. Coming back for the green curry.", stars: 4, ago: "1 day ago" },
    { name: "Wei Ling", text: "Sawatdee! Authentic flavours, generous portions — the tom yum is a must-try.", stars: 5, ago: "3 days ago" },
    { name: "Kumar", text: "Solid value for the price, and the queue moves fast even at lunch.", stars: 4, ago: "1 week ago" },
  ];
  function starRating(n) {
    var s = "";
    for (var i = 1; i <= 5; i++) s += '<img class="p-review__star" src="../images/' + (i <= n ? "star.svg" : "star-empty.svg") + '" alt="">';
    return s;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function reviewCard(r) {
    return '<article class="p-review">' +
      '<p class="p-review__name">' + esc(r.name) + "</p>" +
      '<p class="p-review__text">' + esc(r.text) + "</p>" +
      '<div class="p-review__foot"><span class="p-review__stars">' + starRating(r.stars) + "</span>" +
        '<span class="p-review__dot"></span><span class="p-review__ago">' + r.ago + "</span></div>" +
    "</article>";
  }

  function setReviewsNotice(kind) {
    var rail = document.querySelector("#view-store .p-reviews");
    if (!rail) return;
    var old = rail.parentNode.querySelector("[data-reviews-notice]");
    if (old) old.parentNode.removeChild(old);
    if (!kind) return;
    var p = document.createElement("p");
    p.className = "p-search-empty p-search-empty--notice";
    p.setAttribute("data-reviews-notice", "");
    p.textContent = kind === "empty"
      ? "No reviews yet. Yours would be the first once you've ordered here."
      : "We couldn't load this stall's reviews. The ones below are samples — check your connection and reload.";
    rail.parentNode.insertBefore(p, rail);
  }

  function reviewsSection() {
    return '<section class="p-section">' +
      '<div class="p-section__head"><h2 class="p-section__title">What people say</h2>' +
        '<button class="p-seeall hdr-btn liquid-glass" data-liquid-glass type="button" aria-label="See all reviews">' +
          '<img class="p-seeall__icon" src="../images/arrow-right.svg" alt=""></button></div>' +
      '<div class="p-reviews">' + REVIEWS.map(reviewCard).join("") + "</div></section>";
  }

  /* ---------------- Live reviews (feedback API integration) ---------------------- */
  var API_BASE = "/api"; // same origin as this page — the API serves it

  function timeAgo(iso) {
    var s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    var units = [["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60]];
    for (var i = 0; i < units.length; i++) {
      var n = Math.floor(s / units[i][1]);
      if (n >= 1) return n + " " + units[i][0] + (n > 1 ? "s" : "") + " ago";
    }
    return "just now";
  }
  function apiHeaders() {
    return window.hawkrSession
      ? window.hawkrSession.authHeaders()
      : { "Content-Type": "application/json" };
  }
  function loadReviews(store) {
    if (!store.stallId) { setReviewsNotice("offline"); return; }
    var wrap = document.querySelector("#view-store .p-reviews");
    if (!wrap) return;
    fetch(API_BASE + "/feedback/stall/" + store.stallId, { headers: apiHeaders() })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (res) {
        var rows = (res && res.data) || [];
        if (!rows.length) { wrap.innerHTML = ""; setReviewsNotice("empty"); return; }
        wrap.innerHTML = rows.map(function (f) {
          return reviewCard({
            name: f.UserName,
            text: f.FeedbackComment,
            stars: f.FeedbackRating,
            ago: timeAgo(f.FeedbackDateTime),
          });
        }).join("");
        setReviewsNotice(null);
      })
      .catch(function () { setReviewsNotice("offline"); });
  }

  // ---------------- Menu groups (UNLIMITED — "Entrees / Dessert / …") ------------
  var MENU_GROUPS = [
    { title: "Entrees", dishes: [
      { name: "Escargot", price: "$9.50", img: "beef-goulash.png", desc: "Baked snails in a rich garlic and parsley butter.", allergens: ["dairy"] },
      { name: "Croquettes", price: "$8.25", img: "redhill-prawn-noodle.png", desc: "Small, crispy rolls filled with potato and cheese." },
      { name: "French Onion Soup", price: "$10.00", img: "northern-thai.png", desc: "Caramelised onion broth under toasted bread and melted cheese.", allergens: ["seafood", "nuts", "dairy"] },
      { name: "Lobster Bisque", price: "$9.50", img: "beef-goulash.png", desc: "Smooth, creamy soup of lobster, aromatics and brandy.", allergens: ["seafood"] },
    ] },
    { title: "Dessert", dishes: [
      { name: "The Sahara", price: "$9.50", img: "redhill-prawn-noodle.png", desc: "Warm date sponge under a dune of butterscotch.", allergens: ["dairy", "nuts"] },
      { name: "Antartica", price: "$8.25", img: "northern-thai.png", desc: "Vanilla parfait and meringue shards, cold and crisp." },
      { name: "The one near the pyramids", price: "$10.00", img: "beef-goulash.png", desc: "Layered honey pastry with pistachio and rose.", allergens: ["seafood", "nuts", "dairy"] },
    ] },
  ];
  function menuRow(d) {
    var foot = priceHtml(d) + (d.allergens ? allergenStack(d.allergens) : "");
    var hits = threatIds(d.allergens);
    var flag = hits.length ? '<span class="p-flag p-flag--inline"><img src="../images/' + ALLERGENS[hits[0]].img + '" alt=""><span>' + ALLERGENS[hits[0]].name + "</span></span>" : "";
    var photo = d.img ? '<img class="p-row__photo" src="' + d.img + '" alt="' + d.name + '"' + (window.hawkrImgFallbackAttr ? window.hawkrImgFallbackAttr(d) : "") + '>' : "";
    var desc = d.desc ? '<p class="p-row__desc">' + d.desc + "</p>" : "";
    return '<article class="p-row' + (hits.length ? " p-row--allergen" : "") + '"' + (d._id ? ' data-item="' + d._id + '"' : "") + ">" +
      photo +
      '<div class="p-row__body">' +
        '<div class="p-row__text"><p class="p-dish__name">' + d.name + flag + "</p>" + desc + "</div>" +
        '<div class="p-row__foot">' + foot + "</div>" +
      "</div></article>";
  }
  function menuGroup(g) {
    return '<section class="p-section p-menugroup"><h2 class="p-section__title">' + g.title + "</h2>" +
      '<div class="p-menu">' + g.dishes.map(menuRow).join("") + "</div></section>";
  }

  /* ---------------- Hygiene (Figma 337:1229) ------------------------------------- */
  var SFA_SAFE_NEWS = "https://www.sfa.gov.sg/news-publications/newsroom/new-safety-assurance-for-food-establishment--safe--framework--to-strengthen-food-safety";

  function safeCard(store) {
    return '<div class="hygiene-card hygiene-card--safe">' +
      '<p class="hygiene-card__letter">' + store.grade + "</p>" +
      '<hr class="hygiene-card__rule">' +
      '<p class="hygiene-card__since">Clean since ' + gradeMonth(store) + "</p>" +
      '<p class="hygiene-card__framework">Graded under the SAFE framework</p>' +
    "</div>";
  }
  function legacyCard(store) {
    var g = String(store.grade || "").toUpperCase();
    var tone = ["A", "B", "C", "D"].indexOf(g) > -1 ? g.toLowerCase() : "b"; // unknown → B's green
    return '<div class="hygiene-card hygiene-card--legacy hygiene-card--legacy-' + tone + '">' +
      '<p class="hygiene-card__letter">' + store.grade + "</p>" +
      '<hr class="hygiene-card__rule">' +
      '<div class="hygiene-card__meta">' +
        '<p class="hygiene-card__dated">' + gradeFullDate(store) + "</p>" +
        '<p class="hygiene-card__framework">Graded under the legacy framework</p>' +
      "</div>" +
      '<button class="hygiene-info" type="button" aria-expanded="false" aria-label="Why this grade is different">' +
        '<img src="../images/hygiene-info.svg" alt=""></button>' +
      '<p class="hygiene-note" hidden>This grade predates the SAFE framework, which took effect on 19 Jan 2026, ' +
        'so it does not reflect the latest assessment. ' +
        '<a href="' + SFA_SAFE_NEWS + '" target="_blank" rel="noopener noreferrer">Learn more →</a></p>' +
    "</div>";
  }
  function hygieneSection(store) {
    if (!store.grade || !store.gradedAt) return "";
    return '<section class="p-section"><h2 class="p-section__title">Hygiene</h2>' +
      '<div class="hygiene">' + (isSafeGrade(store) ? safeCard(store) : legacyCard(store)) + "</div></section>";
  }

  /* ---------------- The centre's own state, on the stall ------------------------ */
  function stallNotices(store) {
    var C = window.hawkrCentre;
    if (!C) return "";
    var closure = C.closureLine(store);
    if (closure) {
      return '<section class="centre-note centre-note--' + closure.state + '">' +
        '<p class="centre-note__title">' + closure.short + "</p>" +
        '<p class="centre-note__body">' + closure.long + "</p>" +
        '<p class="centre-note__sub">Reason: ' + closure.reason + "</p>" +
      "</section>";
    }
    var out = "";
    var promo = C.promotionLine(store);
    if (promo) {
      var desc = promo.description ? '<p class="centre-note__body">' + promo.description + "</p>" : "";
      out += '<section class="centre-note centre-note--promo">' +
        '<p class="centre-note__title">' + promo.label + " at " + store.location + "</p>" +
        '<p class="centre-note__body">' + promo.name + " — taken off automatically at checkout." + "</p>" + desc +
      "</section>";
    }
    var stallPromo = C.vendorPromotionLine(store);
    if (stallPromo) {
      var rows = stallPromo.all.map(function (p) {
        return '<p class="centre-note__body">' + p.label + " — " + p.name +
          (p.description ? " " + p.description : "") + "</p>";
      }).join("");
      out += '<section class="centre-note centre-note--promo">' +
        '<p class="centre-note__title">' + (stallPromo.count > 1 ? "Offers at this stall" : "Offer at this stall") + "</p>" +
        rows +
        '<p class="centre-note__sub">Taken off automatically at checkout.</p>' +
      "</section>";
    }
    return out;
  }

  /* ---------------- In-store search (filters the menu by dish NAME) ---------------- */
  function filterMenu(q) {
    q = q.trim().toLowerCase();
    var total = 0;
    document.querySelectorAll("#view-store .p-menugroup").forEach(function (group) {
      var any = false;
      group.querySelectorAll(".p-row").forEach(function (row) {
        var match = !q || row.querySelector(".p-dish__name").textContent.toLowerCase().indexOf(q) !== -1;
        row.hidden = !match;
        if (match) { any = true; total++; }
      });
      group.hidden = !any; // collapse a group with no matches
    });
    var empty = document.querySelector("#view-store .p-search-empty:not(.p-search-empty--notice)");
    if (empty) empty.hidden = !(q && total === 0); // "No dishes match." only when a query matches nothing
  }
  function liveMenu(store) {
    var C = window.hawkrCatalog;
    if (!C || !C.isLive()) return null;
    var groups = C.menuFor(store);
    if (!groups) return null;
    return groups.map(function (g) {
      return { title: g.title, dishes: g.dishes.map(function (m) { return C.toDish(m, store); }) };
    });
  }

  function menuNotice(kind) {
    var words = kind === "empty"
      ? "Nothing on the menu right now. This stall has no items listed as available."
      : "We couldn't load this stall's menu. The dishes below are samples — check your connection and reload.";
    return '<p class="p-search-empty p-search-empty--notice">' + words + "</p>";
  }

  function renderBody(store) {
    ITEM_INDEX = {}; itemSeq = 0; // fresh item registry each time a store's body renders

    var live = liveMenu(store);
    var groups, carousels = "", notice = "";

    if (live) {
      groups = live.map(function (g) {
        return {
          title: g.title,
          dishes: g.dishes.map(function (d) { return regItem(d); }),
        };
      });
      if (!groups.length) notice = menuNotice("empty");

    } else {
      var dishes = storeDishes(store).slice(0, 3);
      while (dishes.length < 3) dishes = dishes.concat(DEFAULT_DISHES.slice(0, 3 - dishes.length));
      var againBadges = [{ text: "Ordered 3 Times", tone: "purple" }, { text: "Ordered Before", tone: "purple" }, { text: "Most Liked", tone: "red" }];
      var popBadges = [{ text: "Most Ordered", tone: "purple" }, { text: "Most Liked", tone: "red" }, null];
      var orderAgain = dishes.map(function (d, i) {
        return regItem({ name: d.name, price: d.price, img: d.img, badge: againBadges[i], add: true,
          desc: DEMO_DESC, customisations: i === 0 ? DEMO_CUSTOM : null });
      });
      var popular = dishes.map(function (d, i) {
        return regItem({ name: d.name, price: d.price, img: d.img, badge: popBadges[i],
          allergens: i === 0 ? ["dairy", "seafood", "nuts"] : null,
          desc: DEMO_DESC, customisations: i === 0 ? DEMO_CUSTOM : null });
      });
      carousels = section("Order again", orderAgain) + section("Popular", popular);
      groups = MENU_GROUPS.map(function (g) {
        return {
          title: g.title,
          dishes: g.dishes.map(function (d) { return regItem(Object.assign({ category: g.title }, d)); }),
        };
      });
      notice = menuNotice("failed");
    }

    var body = document.querySelector("#view-store .store-body");
    if (!body) return;
    var view = document.getElementById("view-store");
    if (view) {
      if (window.hawkrCentre && window.hawkrCentre.isClosed(store)) view.setAttribute("data-centre-closed", "");
      else view.removeAttribute("data-centre-closed");
    }
    body.innerHTML = stallNotices(store) +
      carousels + reviewsSection() + notice +
      groups.map(menuGroup).join("") + hygieneSection(store) +
      '<p class="p-search-empty" hidden>No dishes match.</p>';
    if (typeof initLiquidGlass === "function") initLiquidGlass(body); // wire the glass + / see-all buttons (rendered after load)
    loadReviews(store); // swap the placeholder reviews for live ones from the feedback API
  }

  /* ---------------- Cart FAB (Figma 453:1632) ------------------------------------ */
  var currentStoreName = null;
  function fabEl() { return document.querySelector(".cart-fab"); }
  function updateFab() {
    var fab = fabEl();
    if (fab) fab.classList.toggle("cart-fab--active", window.hawkrBag.count() > 0);
  }
  function bumpFab() {
    var fab = fabEl();
    if (!fab || !fab.classList.contains("cart-fab--active")) return;
    fab.classList.remove("cart-fab--bump");
    void fab.offsetWidth; // reflow so the animation restarts
    fab.classList.add("cart-fab--bump");
  }

  function renderStore(store) {
    var v = document.getElementById("view-store");
    if (!v || !store) return;
    var img = v.querySelector(".store-hero__img");
    img.hidden = !store.img;
    if (store.img) {
      img.onerror = store.imgFallback
        ? function () { img.onerror = null; img.src = store.imgFallback; }
        : null;
      img.src = store.img;
      img.alt = store.name;
    } else { img.removeAttribute("src"); img.alt = ""; }

    v.querySelector(".store-title").textContent = store.name;
    v.querySelector(".store-sub").textContent = "@ " + store.location;

    var hyg = v.querySelector(".store-hygiene");
    hyg.hidden = !store.grade;
    if (store.grade) {
      hyg.querySelector(".grade-chip__letter").textContent = store.grade;
      hyg.querySelector(".grade-chip__text").textContent = "Clean since " + gradeMonth(store);
    }

    var dist = distanceLabel(store);
    var rating = store.rating
      ? "<span>" + store.rating + "</span>" +
        '<img class="store-rating__star" src="../images/star.svg" alt="">' +
        "<span>(" + store.reviews + ")</span>"
      : "";
    v.querySelector(".store-rating").innerHTML =
      rating + (dist ? (rating ? '<span class="store-rating__dot"></span>' : "") + "<span>" + dist + "</span>" : "");
    currentStoreName = store.name;
    renderBody(store); // carousels · reviews · menu · hygiene
    updateFab();       // the bag is global, so the FAB shows if ANY stall has something in it
    var bar = v.querySelector(".store-bar"); if (bar) bar.classList.remove("store-bar--hidden"); // always show on open
    if (typeof window.syncFavouriteHearts === "function") window.syncFavouriteHearts();
  }

  function openStore(name) {
    var store = findStore(name);
    if (!store) return;
    renderStore(store);
    if (typeof currentView === "function" && currentView() === "store") return;
    history.pushState({ view: "store" }, "", "#store");
    var go = function () { if (typeof applyView === "function") applyView("store"); else document.body.dataset.view = "store"; };
    if (document.startViewTransition) {
      document.body.classList.add("to-store");
      var cleanup = function () { document.body.classList.remove("to-store"); };
      document.startViewTransition(go).finished.then(cleanup, cleanup);
    } else {
      go();
    }
  }

  window.openStore = openStore;
  window.renderStoreProfile = renderStore;   // util hook (render without navigating)
  window.distanceLabel = distanceLabel;      // cart.js renders "@ centre · 1.5km" stall headers
  window.dishCardHtml = dishCard;
  window.findDish = function (storeName, dishName) {
    var store = findStore(storeName);
    if (!store) return null;
    if (currentStoreName !== storeName) renderStore(store);
    for (var k in ITEM_INDEX) { if (ITEM_INDEX[k].name === dishName) return ITEM_INDEX[k]; }
    return null;
  };
  window.currentStoreName = function () { return currentStoreName; }; // which stall a new line belongs to

  document.addEventListener("DOMContentLoaded", function () {
    // tap any store card (home FYP or results feed) → open its profile
    document.addEventListener("click", function (e) {
      var card = e.target.closest(".store-card");
      if (!card) return;
      e.preventDefault();
      var name = card.getAttribute("data-store");
      if (name) openStore(name);
    });
    document.addEventListener("click", function (e) {
      var card = document.querySelector("#view-store .hygiene-card--legacy");
      if (!card) return;
      var note = card.querySelector(".hygiene-note");
      if (note.contains(e.target)) return;
      var badge = card.querySelector(".hygiene-info");
      var show = e.target.closest(".hygiene-info") === badge && note.hidden;
      note.hidden = !show;
      badge.setAttribute("aria-expanded", String(show));
    });

    function quickAdd(el) {
      if (window.hawkrCentre && window.hawkrCentre.isClosed(currentStoreName)) return;
      var card = el.closest("[data-item]");
      var d = card && ITEM_INDEX[card.getAttribute("data-item")];
      if (d) window.hawkrBag.add(d, { store: currentStoreName });
    }

    document.addEventListener("click", function (e) {
      var add = e.target.closest(".p-add");
      if (!add || !document.getElementById("view-store").contains(add)) return;
      e.preventDefault();
      e.stopPropagation();
      quickAdd(add);
    });

    // Tap a dish card / menu row (anywhere but the + itself).
    document.addEventListener("click", function (e) {
      if (e.target.closest(".p-add")) return; // the + button handles its own click
      var card = e.target.closest("[data-item]");
      if (!card || !document.getElementById("view-store").contains(card)) return;
      if (card.querySelector(".p-add")) { // Order-again cards carry a + → body tap quick-adds too
        quickAdd(card);
        return;
      }
      var d = ITEM_INDEX[card.getAttribute("data-item")]; // Popular / menu → item page
      if (d && typeof window.openItem === "function") window.openItem(d);
    });

    var view = document.getElementById("view-store");
    var field = view && view.querySelector(".store-search");
    var input = field && field.querySelector(".store-search__input");
    var clear = field && field.querySelector(".store-search__clear");
    function enterSearch() { view.classList.add("is-searching"); input.focus(); }
    function exitSearch() { view.classList.remove("is-searching"); input.value = ""; field.classList.remove("is-populated"); filterMenu(""); }

    var back = view && view.querySelector("[data-store-back]");
    if (back) back.addEventListener("click", function () {
      if (view.classList.contains("is-searching")) exitSearch();
      else history.back();
    });

    var lastCount = window.hawkrBag.count();
    window.hawkrBag.onChange(function () {
      var n = window.hawkrBag.count(), grew = n > lastCount, wasActive = lastCount > 0;
      lastCount = n;
      updateFab();
      if (grew && wasActive && document.body.dataset.view !== "item") bumpFab();
    });
    updateFab();

    // The FAB is shell-level now, so this listener is app-wide, not store-scoped.
    var fab = fabEl();
    if (fab) fab.addEventListener("click", function () {
      if (typeof window.openCart === "function") window.openCart();
    });

    if (view && typeof autoHideBar === "function") {
      autoHideBar(view, view.querySelector(".store-bar"), "store-bar--hidden", {
        paused: function () { return view.classList.contains("is-searching"); },
      });
    }

    window.addEventListener("popstate", function () {
      if (location.hash !== "#store") return;
      var bar = view && view.querySelector(".store-bar");
      if (bar) bar.classList.remove("store-bar--hidden");
    });

    if (view && field && input) {
      view.querySelector("[data-store-search]").addEventListener("click", enterSearch);
      input.addEventListener("input", function () {
        field.classList.toggle("is-populated", input.value.length > 0); // magnifier → × swap
        filterMenu(input.value);
      });
      clear.addEventListener("click", function () {
        input.value = "";
        field.classList.remove("is-populated");
        filterMenu("");
        input.focus();
      });
    }
  });
})();
