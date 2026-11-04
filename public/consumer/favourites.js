/* favourites.js — what the customer has hearted. */
(function (global) {
  "use strict";

  var KEY = "hawkr:favourites";
  var state = { stalls: [], dishes: [] };
  var subs = [];

  var pending = 0;

  var status = null;

  function save() {
    try { if (global.localStorage) localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  }
  function load() {
    try {
      var raw = global.localStorage && localStorage.getItem(KEY);
      if (!raw) return;
      var s = JSON.parse(raw);
      if (!s) return;
      state.stalls = (s.stalls || []).filter(function (n) { return typeof n === "string"; });
      state.dishes = (s.dishes || []).filter(function (d) { return d && d.store && d.name; });
    } catch (_) {}
  }
  function emit() { save(); subs.forEach(function (fn) { try { fn(); } catch (_) {} }); }

  function dishKey(store, name) { return store + "|" + name; }
  function dishIndex(store, name) {
    var k = dishKey(store, name);
    return state.dishes.map(function (d) { return dishKey(d.store, d.name); }).indexOf(k);
  }

  /* THE API LAYER */

  function session() {
    try {
      var s = global.hawkrSession && global.hawkrSession.getSession();
      return s && Number.isInteger(Number(s.userId)) ? s : null;
    } catch (_) { return null; }
  }

  function headers() {
    return (global.hawkrSession && global.hawkrSession.authHeaders())
      || { "Content-Type": "application/json" };
  }

  function call(method, path, body) {
    return fetch(path, {
      method: method,
      headers: headers(),
      body: body === undefined ? undefined : JSON.stringify(body)
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (parsed) {
        if (!res.ok) {
          var err = new Error((parsed && parsed.message) || ("Request failed (" + res.status + ")"));
          err.status = res.status;
          throw err;
        }
        return parsed;
      });
    });
  }

  /* NAME <-> ID */

  function allStores() {
    try { return typeof STORES !== "undefined" ? STORES : []; } catch (_) { return []; }
  }
  function centreRecord(name) {
    try { return (typeof CENTRES !== "undefined" && CENTRES[name]) || null; } catch (_) { return null; }
  }

  function idsForStall(name) {
    var store = allStores().filter(function (s) { return s.name === name; })[0];
    if (!store || store.stallId == null) return null;
    var centre = centreRecord(store.location);
    if (!centre || centre.hawkerId == null) return null;
    return { hawker_id: Number(centre.hawkerId), stall_id: Number(store.stallId) };
  }

  function stallNameFor(stallId) {
    var store = allStores().filter(function (s) { return Number(s.stallId) === Number(stallId); })[0];
    return store ? store.name : null;
  }

  /* ======================================================================
     STATUS
     ====================================================================== */

  function setStatus(text, tone) {
    status = text ? { text: text, tone: tone || "note" } : null;
  }

  function failureText(err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return "Your session has expired. Log in again to save your favourites.";
    }
    if (err && err.status === 400) return "The server refused that: " + err.message;
    return "Couldn't reach the server — this heart is on this device for now.";
  }

  /* ======================================================================
     READ AND WRITE
     ====================================================================== */

  function sync() {
    if (!isMember()) {
      setStatus("You're browsing as a guest, so these live on this device only.", "note");
      emit();
      return Promise.resolve();
    }
    return call("GET", "/api/favorites/user/" + userId() + "?type=stall")
      .then(function (body) {
        if (pending > 0) return;                 // a toggle is still in flight; it is newer

        var localOnly = state.stalls.filter(function (name) { return !idsForStall(name); });
        var fromServer = ((body && body.data) || [])
          .map(function (row) { return stallNameFor(row.stall_id); })
          .filter(Boolean);

        state.stalls = fromServer.concat(localOnly.filter(function (name) {
          return fromServer.indexOf(name) === -1;
        }));
        setStatus(null);
      })
      .catch(function (err) {
        setStatus(
          (err && (err.status === 401 || err.status === 403))
            ? "Your session has expired — showing what's saved on this device."
            : "Couldn't reach the server — showing what's saved on this device.",
          "warn"
        );
      })
      .then(emit);
  }

  function pushStall(name, on) {
    if (!isMember()) return;

    var ids = idsForStall(name);
    if (!ids) {
      setStatus(name + " isn't in the stall catalogue yet, so this heart stays on this device.", "note");
      emit();
      return;
    }

    pending++;
    call("POST", "/api/favorites/user/" + userId() + "/toggle", ids)
      .then(function (body) {
        var favorited = !!(body && body.data && body.data.favorited);
        var at = state.stalls.indexOf(name);
        if (favorited && at === -1) state.stalls.push(name);
        else if (!favorited && at > -1) state.stalls.splice(at, 1);
        setStatus(null);
      })
      .catch(function (err) {
        setStatus(failureText(err), "warn");
      })
      .then(function () { pending--; emit(); });
  }

  function isMember() { return !!session(); }
  function userId() { var s = session(); return s ? s.userId : null; }

  load();

  global.hawkrFavourites = {
    isStall: function (name) { return state.stalls.indexOf(name) > -1; },
    // returns the NEW state, so a caller can style the heart without re-querying
    toggleStall: function (name) {
      var i = state.stalls.indexOf(name);
      if (i > -1) state.stalls.splice(i, 1); else state.stalls.push(name);
      var on = i === -1;
      setStatus(null);
      emit();
      pushStall(name, on);
      return on;
    },
    isDish: function (store, name) { return dishIndex(store, name) > -1; },
    toggleDish: function (store, dish) {
      var i = dishIndex(store, dish.name);
      if (i > -1) state.dishes.splice(i, 1);
      else state.dishes.push({
        store: store, name: dish.name, price: dish.price, img: dish.img,
        desc: dish.desc || null, allergens: dish.allergens || null
      });
      emit();
      return i === -1;
    },
    stalls: function () { return state.stalls.slice(); },
    dishes: function () { return state.dishes.slice(); },
    count: function () { return state.stalls.length + state.dishes.length; },
    onChange: function (fn) { if (typeof fn === "function") subs.push(fn); },

    /* ---- the account half ---- */
    isMember: isMember,
    sync: sync,
    status: function () { return status; }
  };
})(window);
