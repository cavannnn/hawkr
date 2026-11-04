(function (global, doc) {
  "use strict";

  var KEY = "hawkr.guest";

  // ---- avatar colour: hash(id) → hue, fixed L/C so avatars share one weight ----
  function hashInt(s) {
    var h = 2166136261; // FNV-1a (Math.imul keeps it exact in 32-bit)
    for (var i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 16777619); }
    return h >>> 0;
  }
  function hueOf(seed) { return hashInt(String(seed)) % 360; }
  function avatarGradient(hue) {
    return "radial-gradient(circle at 32% 30%, oklch(0.86 0.10 " + hue + "), " +
           "oklch(0.93 0.05 " + hue + ") 55%, #fff)";
  }

  // ---- placeholder handle: alliterative customer-adjective + noun ("Wandering Walrus") ----
  function pick(arr, seed) { return arr[Math.abs(seed) % arr.length]; }
  function placeholderName(seed) {
    var buckets = global.HAWKR_GUEST_NAMES || {};
    var letters = Object.keys(buckets).filter(function (k) {
      var b = buckets[k];
      return b && b.adj && b.adj.length && b.nouns && b.nouns.length;
    });
    if (!letters.length) return "Hungry Guest";
    var b = buckets[letters[Math.abs(seed) % letters.length]];
    return pick(b.adj, seed) + " " + pick(b.nouns, Math.floor(seed / 7) + 1);
  }

  // ---- persistence ----
  function newId() {
    try { if (global.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {}
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function normalize(s) {
    var n = { id: s.id, name: s.name || null, signedUp: !!s.signedUp,
              orders: s.orders || 0, since: s.since || null };
    if (n.signedUp) {
      if (s.allergens) n.allergens = s.allergens;
      if (s.customAllergens) n.customAllergens = s.customAllergens;
    }
    return n;
  }
  function freshGuest() {
    return { id: newId(), name: null, signedUp: false, orders: 0, since: null };
  }
  function load() {
    try {
      var raw = global.localStorage && localStorage.getItem(KEY);
      if (raw) { var s = JSON.parse(raw); if (s && s.id) return normalize(s); }
    } catch (_) {}
    return null;
  }
  function save() {
    try { if (global.localStorage) localStorage.setItem(KEY, JSON.stringify(normalize(current))); } catch (_) {}
  }

  // ---- derive display + render ----
  function displayNameOf(s) {
    return (s.name && String(s.name).trim()) || placeholderName(hashInt(s.id));
  }
  function subtitleFor(s) {
    return s.signedUp ? (s.orders + " Orders · Since " + s.since) : "Guest";
  }
  var els = {};
  function render() {
    if (!els.avatar || !current) return;
    var name = displayNameOf(current);
    els.avatar.textContent = (name.charAt(0) || "?").toUpperCase();
    els.avatar.style.background = avatarGradient(hueOf(current.id)); // colour keyed to the STABLE id
    els.name.textContent = name;
    els.role.textContent = subtitleFor(current);
  }

  var current;
  function init() {
    els.avatar = doc.querySelector(".sidebar__avatar");
    els.name = doc.querySelector(".sidebar__name");
    els.role = doc.querySelector(".sidebar__role");
    if (!els.avatar) return;
    current = load() || freshGuest(); // returning guest → same id/name/colour; first-timer → mint one
    save();                            // persist a freshly-minted guest (idempotent for a returning one)
    render();
  }

  // ---- seam for the checkout / auth / DB layer (now persists) ----
  global.hawkrProfile = {
    set: function (patch) {
      if (!current) current = freshGuest();
      if (patch) for (var k in patch) { if (k !== "id" && patch.hasOwnProperty(k)) current[k] = patch[k]; }
      save(); render(); return current;
    },
    promoteToName: function (name) {
      if (!current) current = freshGuest();
      current.name = name; save(); render(); return current;
    },
    get: function () { return current; },
    displayName: function () { return current ? displayNameOf(current) : ""; },
    avatar: function () {
      if (!current) return { letter: "?", gradient: "" };
      return { letter: (displayNameOf(current).charAt(0) || "?").toUpperCase(), gradient: avatarGradient(hueOf(current.id)) };
    }
  };

  doc.addEventListener("DOMContentLoaded", init);
})(window, document);
