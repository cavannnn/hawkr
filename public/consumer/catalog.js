(function (global) {
  "use strict";

  var API = "/api";

  function apiHeaders() {
    return global.hawkrSession
      ? global.hawkrSession.authHeaders()
      : { "Content-Type": "application/json" };
  }

  function get(path) {
    return fetch(API + path, { headers: apiHeaders() })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)); })
      .then(function (res) { return (res && res.data) || []; });
  }

  function jsonArray(v) {
    if (Array.isArray(v)) return v;
    if (typeof v === "string") { try { return JSON.parse(v) || []; } catch (_) { return []; } }
    return [];
  }

  /* ---------------- state ---------------- */
  var state = "loading";
  var stores = [];
  var centres = {};
  var menus = {};       // stallId -> [{ title, dishes }]
  var readyFns = [];
  var done = false;

  /* ---------------- the one place a picture is chosen ---------------- */
  function imageFor(cuisine) {
    if (!cuisine) return null;
    var want = String(cuisine).trim().toLowerCase();
    var list;
    try { list = typeof CUISINES !== "undefined" ? CUISINES : []; } catch (_) { return null; }
    var hit = list.filter(function (c) { return c.name.toLowerCase() === want; })[0];
    return hit ? hit.img : null;
  }

  function priceLabel(v) {
    if (global.hawkrMoney) return global.hawkrMoney.format(global.hawkrMoney.cents(v));
    return "$" + (Math.round((parseFloat(v) || 0) * 100) / 100).toFixed(2);
  }

  /* ---------------- normalising ---------------- */
  function resolveImage(value) {
    if (!value) return null;
    if (value.charAt(0) === "/" || /^(https?:)?\/\//.test(value)) return value;
    return "/images/" + value;
  }

  function stallToStore(s) {
    var store = {
      name: s.stall_name,
      location: s.hawker_name || "",
      stallId: s.stall_id != null ? Number(s.stall_id) : null,
      hawkerId: s.hawker_id != null ? Number(s.hawker_id) : null,
      tags: s.cuisine_type ? [String(s.cuisine_type)] : [],
      desc: s.description || null,
      unit: s.stall_number || null,
      neaGrade: s.nea_grade || null,
      pendingGrade: s.pending_grade || null,
    };
    var cuisineImg = resolveImage(imageFor(s.cuisine_type));
    var img = resolveImage(s.image_url) || cuisineImg;
    if (img) store.img = img;
    if (cuisineImg && cuisineImg !== img) store.imgFallback = cuisineImg;
    return store;
  }

  function groupMenu(items) {
    var order = [], by = {};
    items.forEach(function (m) {
      var title = (m.category && String(m.category).trim()) || "Menu";
      if (!by[title]) { by[title] = { title: title, dishes: [] }; order.push(by[title]); }
      by[title].dishes.push(m);
    });
    return order;
  }

  function itemToDish(m, store) {
    var original = Number(m.original_price);
    var charged = Number(m.price);
    var dish = {
      name: m.item_name,
      price: priceLabel(m.price),
      was: isFinite(original) && isFinite(charged) && original > charged ? priceLabel(original) : null,
      menuId: m.menu_id != null ? Number(m.menu_id) : null,
      category: (m.category && String(m.category).trim()) || null,
      desc: null,
      allergens: null,
      customisations: null,
    };
    var img = store && store.img;
    if (img) dish.img = img;
    if (store && store.imgFallback) dish.imgFallback = store.imgFallback;
    return dish;
  }

  /* ---------------- load ---------------- */
  function settle(next) {
    state = next;
    done = true;
    readyFns.splice(0).forEach(function (fn) { try { fn(); } catch (_) {} });
  }

  var ready = Promise.all([get("/hawkers"), get("/stalls")])
    .then(function (res) {
      var hawkers = res[0] || [];
      var stalls = res[1] || [];

      hawkers.forEach(function (h) {
        if (!h || !h.name) return;
        var rec = { name: h.name, hawkerCentre: true, hawkerId: h.hawker_id != null ? Number(h.hawker_id) : null };
        if (h.address) rec.addr = h.address;
        if (h.operating_hours) rec.hours = h.operating_hours;
        centres[h.name] = rec;
      });

      stalls.forEach(function (s) {
        if (!s || !s.stall_name) return;
        var store = stallToStore(s);
        stores.push(store);
        if (store.stallId != null) menus[store.stallId] = groupMenu(jsonArray(s.menu_items));

        if (store.location && !centres[store.location]) {
          centres[store.location] = { name: store.location, hawkerCentre: true, hawkerId: store.hawkerId };
        }

        var rec = centres[store.location];
        if (rec && rec.hours) store.statusNote = rec.hours;
      });

      settle(stores.length ? "live" : "empty");
    })
    .catch(function () {
      settle("failed");
    });

  global.hawkrCatalog = {
    ready: function () { return ready; },
    state: function () { return state; },
    isLive: function () { return state === "live"; },
    stores: function () { return stores.slice(); },
    centres: function () { return centres; },
    menuFor: function (store) {
      var id = store && (typeof store === "object" ? store.stallId : store);
      if (id == null) return null;
      var g = menus[id];
      return g ? g.map(function (x) { return { title: x.title, dishes: x.dishes.slice() }; }) : null;
    },
    dishesFor: function (store) {
      var groups = global.hawkrCatalog.menuFor(store);
      if (!groups) return null;
      var out = [];
      groups.forEach(function (g) {
        g.dishes.forEach(function (m) { out.push(itemToDish(m, store)); });
      });
      return out;
    },
    toDish: itemToDish,
    imageFor: imageFor,
    onReady: function (fn) {
      if (typeof fn !== "function") return;
      if (done) fn(); else readyFns.push(fn);
    },
  };
})(window);
