(function (global, doc) {
  "use strict";

  /* 1. THE API LAYER */

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

  async function call(method, path, body) {
    var res = await fetch(path, {
      method: method,
      headers: headers(),
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    var parsed = null;
    try { parsed = await res.json(); } catch (_) {}
    if (!res.ok) {
      var err = new Error((parsed && (parsed.details || parsed.message)) || ("Request failed (" + res.status + ")"));
      err.status = res.status;
      throw err;
    }
    return parsed;
  }

  var prefs = {
    /* Is there an account behind this screen? Everything below branches on it. */
    isMember: function () { return !!session(); },
    userId: function () { var s = session(); return s ? s.userId : null; },

    /* ---- allergens ---- */
    async loadAllergens() {
      var s = session();
      if (!s) return null;                      // a guest has nothing to load
      var body = await call("GET", "/api/allergens/user/" + s.userId);
      var d = (body && body.data) || {};
      return { allergens: d.allergens || [], customAllergens: d.customAllergens || [] };
    },
    async saveAllergens(allergens, customAllergens) {
      var s = session();
      if (!s) return null;
      return call("PUT", "/api/allergens/user/" + s.userId, {
        allergens: allergens || [],
        customAllergens: customAllergens || []
      });
    },

    /* ---- cuisines ---- */
    async loadCuisines() {
      var s = session();
      if (!s) return null;
      var body = await call("GET", "/api/cuisines/user/" + s.userId);
      return ((body && body.data && body.data.cuisines) || []);
    },
    async saveCuisines(cuisines) {
      var s = session();
      if (!s) return null;
      return call("PUT", "/api/cuisines/user/" + s.userId, { cuisines: cuisines || [] });
    }
  };
  global.hawkrPrefs = prefs;

  function cachedAllergens() {
    var pr = global.hawkrProfile && hawkrProfile.get();
    return {
      allergens: (pr && pr.allergens) || [],
      customAllergens: (pr && pr.customAllergens) || []
    };
  }
  function cacheAllergens(allergens, customAllergens) {
    if (!global.hawkrProfile) return;
    hawkrProfile.set({ allergens: allergens.slice(), customAllergens: customAllergens.slice() });
  }
  prefs.cachedAllergens = cachedAllergens;
  prefs.cacheAllergens = cacheAllergens;

  /* ======================================================================
     2. THE SETTINGS SECTIONS
     ====================================================================== */

  var A = {                       // allergens section state
    allergens: [], customs: [],   // the saved answer, as last known
    draft: null,                  // { allergens:Set, customs:[] } while editing
    stale: false                  // showing the cache because the server could not be reached
  };
  var P = {                       // palette section state
    cuisines: [],
    draft: null,
    stale: false
  };
  var MAX_CUISINES = 5;           // mirrors config/cuisines.js; the SERVER holds the rule

  function view() { return doc.getElementById("view-settings"); }
  function q(sel) { var v = view(); return v && v.querySelector(sel); }

  function cuisineCatalog() {
    return [].slice.call(doc.querySelectorAll("#view-cuisines .palate-plate")).map(function (el) {
      var img = el.querySelector("img");
      return { name: el.dataset.cuisine, img: img ? img.getAttribute("src") : "" };
    });
  }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---- the status line under each header ----
  function setStatus(sel, text, tone) {
    var el = q(sel);
    if (!el) return;
    el.textContent = text || "";
    el.hidden = !text;
    el.className = "pref-status" + (tone ? " pref-status--" + tone : "");
  }

  /* ---- the Edit/Save chip, copied from settings-page.js so all four behave alike ---- */
  function setChip(sel, saving, labelWhenOn) {
    var btn = q(sel);
    if (!btn) return;
    btn.classList.toggle("is-active", saving);
    var label = btn.querySelector(".st-chip__label");
    if (label) label.textContent = saving ? (labelWhenOn || "Save") : "Edit";
    var icon = btn.querySelector(".st-chip__icon");
    if (icon) icon.style.display = saving ? "none" : "";
  }

  /* ------------------------------------------------------------------
     ALLERGENS
     ------------------------------------------------------------------ */

  function allergenMeta(id) {
    return (global.HAWKR_ALLERGENS || []).filter(function (a) { return a.id === id; })[0] || null;
  }

  function renderAllergenSummary() {
    var box = q("[data-allergens-summary]");
    if (!box) return;
    var tags = A.allergens.map(function (id) {
      var a = allergenMeta(id);
      if (!a) return '<span class="pref-tag">' + esc(id) + "</span>";
      return '<span class="pref-tag"><span class="pref-tag__disc" style="background-color:' + a.bg +
        ";background-image:url(../images/" + a.img + ')"></span>' + esc(a.name) + "</span>";
    }).concat(A.customs.map(function (name) {
      return '<span class="pref-tag pref-tag--custom">' + esc(name) + "</span>";
    }));

    box.innerHTML = tags.length ? tags.join("")
      : '<p class="pref-empty">Nothing flagged. Tap Edit to tell us what to look out for.</p>';
  }

  function openAllergenEditor() {
    A.draft = { allergens: new Set(A.allergens), customs: A.customs.slice() };
    // the onboarding picker, rendered straight into its saved state
    global.renderAllergenPicks(q("[data-allergens-list]"), A.allergens);
    var other = q("[data-allergens-other]");
    if (other) other.value = A.customs.join(", ");
    q("[data-allergens-panel]").hidden = false;
    q("[data-allergens-summary]").hidden = true;
    setChip("[data-allergens-edit]", true);
  }

  function closeAllergenEditor() {
    A.draft = null;
    var panel = q("[data-allergens-panel]");
    if (panel) panel.hidden = true;
    var sum = q("[data-allergens-summary]");
    if (sum) sum.hidden = false;
    setChip("[data-allergens-edit]", false);
  }

  async function saveAllergens() {
    if (!A.draft) return;
    var allergens = Array.from(A.draft.allergens);
    var other = q("[data-allergens-other]");
    var customs = (other ? other.value : "").split(",")
      .map(function (s) { return s.trim(); }).filter(Boolean);

    A.allergens = allergens;
    A.customs = customs;

    cacheAllergens(allergens, customs);
    renderAllergenSummary();
    closeAllergenEditor();

    if (!prefs.isMember()) {
      setStatus("[data-allergens-status]",
        "Kept for this visit only — join hawkr to save these to your account.", "note");
      return;
    }

    setStatus("[data-allergens-status]", "Saving…", "busy");
    try {
      await prefs.saveAllergens(allergens, customs);
      A.stale = false;
      setStatus("[data-allergens-status]", "Saved to your account.", "ok");
    } catch (err) {
      A.stale = true;
      setStatus("[data-allergens-status]", saveFailure(err), "warn");
    }
  }

  function saveFailure(err) {
    if (err && err.status === 400) return "The server refused that: " + err.message;
    if (err && (err.status === 401 || err.status === 403)) return "Your session has expired. Log in again to save this.";
    return "Couldn't reach the server — kept on this device for now.";
  }

  async function loadAllergenSection() {
    if (!prefs.isMember()) {
      var local = cachedAllergens();
      A.allergens = local.allergens.slice();
      A.customs = local.customAllergens.slice();
      renderAllergenSummary();
      setStatus("[data-allergens-status]",
        "You're browsing as a guest, so these last for this visit only.", "note");
      return;
    }
    setStatus("[data-allergens-status]", "Loading…", "busy");
    try {
      var saved = await prefs.loadAllergens();
      A.allergens = saved.allergens;
      A.customs = saved.customAllergens;
      A.stale = false;
      cacheAllergens(A.allergens, A.customs);    // the server's answer replaces the cache
      renderAllergenSummary();
      setStatus("[data-allergens-status]", "", null);
    } catch (err) {
      var cache = cachedAllergens();
      A.allergens = cache.allergens.slice();
      A.customs = cache.customAllergens.slice();
      A.stale = true;
      renderAllergenSummary();
      setStatus("[data-allergens-status]",
        (err && (err.status === 401 || err.status === 403))
          ? "Your session has expired — showing what's saved on this device."
          : "Couldn't reach the server — showing what's saved on this device.", "warn");
    }
  }

  /* ------------------------------------------------------------------
     MY PALETTE
     ------------------------------------------------------------------ */

  function renderPaletteSummary() {
    var box = q("[data-palette-summary]");
    if (!box) return;
    var cat = cuisineCatalog();
    var tags = P.cuisines.map(function (name) {
      var c = cat.filter(function (x) { return x.name === name; })[0];
      return '<span class="pref-tag">' +
        (c ? '<img class="pref-tag__plate" src="' + esc(c.img) + '" alt="">' : "") +
        esc(name) + "</span>";
    });
    box.innerHTML = tags.length ? tags.join("")
      : '<p class="pref-empty">No cuisines chosen yet. Tap Edit to pick up to five.</p>';
  }

  function renderPaletteCount() {
    var el = q("[data-palette-count]");
    if (!el || !P.draft) return;
    var n = P.draft.size;
    el.textContent = n + " of " + MAX_CUISINES;
    el.classList.toggle("is-full", n >= MAX_CUISINES);
  }

  function openPaletteEditor() {
    P.draft = new Set(P.cuisines);
    var grid = q("[data-palette-grid]");
    if (grid) {
      grid.innerHTML = cuisineCatalog().map(function (c) {
        var on = P.draft.has(c.name);
        return '<button class="pal-pick' + (on ? " is-selected" : "") + '" type="button" ' +
            'data-cuisine="' + esc(c.name) + '" aria-pressed="' + on + '">' +
          '<span class="pal-pick__disc"><img src="' + esc(c.img) + '" alt=""></span>' +
          '<span class="pal-pick__label">' + esc(c.name) + "</span>" +
        "</button>";
      }).join("");
    }
    q("[data-palette-panel]").hidden = false;
    q("[data-palette-summary]").hidden = true;
    setChip("[data-palette-edit]", true);
    renderPaletteCount();
  }

  function closePaletteEditor() {
    P.draft = null;
    var panel = q("[data-palette-panel]");
    if (panel) panel.hidden = true;
    var sum = q("[data-palette-summary]");
    if (sum) sum.hidden = false;
    setChip("[data-palette-edit]", false);
  }

  async function savePalette() {
    if (!P.draft) return;
    var cuisines = Array.from(P.draft);
    P.cuisines = cuisines;
    renderPaletteSummary();
    closePaletteEditor();

    setStatus("[data-palette-status]", "Saving…", "busy");
    try {
      await prefs.saveCuisines(cuisines);
      P.stale = false;
      setStatus("[data-palette-status]", "Saved to your account.", "ok");
    } catch (err) {
      P.stale = true;
      setStatus("[data-palette-status]", saveFailure(err), "warn");
    }
  }

  async function loadPaletteSection() {
    var guestBox = q("[data-palette-guest]");
    var head = q("[data-palette-edit]");

    if (!prefs.isMember()) {
      if (guestBox) guestBox.hidden = false;
      if (head) head.hidden = true;
      var sum = q("[data-palette-summary]");
      if (sum) sum.hidden = true;
      setStatus("[data-palette-status]", "", null);
      return;
    }
    if (guestBox) guestBox.hidden = true;
    if (head) head.hidden = false;

    setStatus("[data-palette-status]", "Loading…", "busy");
    try {
      P.cuisines = await prefs.loadCuisines();
      P.stale = false;
      renderPaletteSummary();
      setStatus("[data-palette-status]", "", null);
    } catch (err) {
      P.stale = true;
      P.cuisines = [];
      renderPaletteSummary();
      setStatus("[data-palette-status]",
        (err && (err.status === 401 || err.status === 403))
          ? "Your session has expired. Log in again to see your palette."
          : "Couldn't reach the server, so we can't show your palette right now.", "warn");
    }
  }

  /* ------------------------------------------------------------------
     WIRING
     ------------------------------------------------------------------ */
  doc.addEventListener("DOMContentLoaded", function () {
    var v = view();
    if (!v) return;

    v.addEventListener("click", function (e) {
      /* ---- allergens ---- */
      if (e.target.closest("[data-allergens-edit]")) {
        if (A.draft) saveAllergens(); else openAllergenEditor();
        return;
      }
      var pick = e.target.closest(".allergy-pick");
      if (pick && A.draft) {
        var id = pick.dataset.allergen;
        var on = !A.draft.allergens.has(id);
        A.draft.allergens[on ? "add" : "delete"](id);
        pick.classList.toggle("is-selected", on);
        pick.setAttribute("aria-pressed", String(on));
        return;
      }

      /* ---- palette ---- */
      if (e.target.closest("[data-palette-edit]")) {
        if (P.draft) savePalette(); else openPaletteEditor();
        return;
      }
      if (e.target.closest("[data-palette-join]")) {
        if (typeof navigate === "function") navigate("profile");
        return;
      }
      var plate = e.target.closest(".pal-pick");
      if (plate && P.draft) {
        var name = plate.dataset.cuisine;
        var add = !P.draft.has(name);
        if (add && P.draft.size >= MAX_CUISINES) {
          setStatus("[data-palette-status]",
            "That's five — remove one to add another.", "warn");
          return;
        }
        P.draft[add ? "add" : "delete"](name);
        plate.classList.toggle("is-selected", add);
        plate.setAttribute("aria-pressed", String(add));
        renderPaletteCount();
        setStatus("[data-palette-status]", "", null);
        return;
      }
    });

    new MutationObserver(function () {
      if (doc.body.dataset.view !== "settings") {
        if (A.draft) closeAllergenEditor();
        if (P.draft) closePaletteEditor();
        return;
      }
      loadAllergenSection();
      loadPaletteSection();
    }).observe(doc.body, { attributes: true, attributeFilter: ["data-view"] });

    if (doc.body.dataset.view === "settings") {
      loadAllergenSection();
      loadPaletteSection();
    }
  });
})(window, document);
