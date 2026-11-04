(function (global) {
  "use strict";

  var KEY = "hawkr:cards";
  var DEMO = [
    { id: "c1", brand: "mastercard", logo: "card-mastercard.svg", last4: "8210", exp: "03/33" },
    { id: "c2", brand: "visa",       logo: "card-visa.svg",       last4: "9402", exp: "03/28" },
    { id: "c3", brand: "amex",       logo: "card-amex.svg",       last4: "1005", exp: "07/29" },
  ];

  var cards = null;
  var subs = [];

  function save() {
    try { if (global.localStorage) localStorage.setItem(KEY, JSON.stringify(cards)); } catch (_) {}
  }
  function load() {
    try {
      var raw = global.localStorage && localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (Array.isArray(s)) { cards = s.filter(function (c) { return c && c.id && c.last4; }); return; }
      }
    } catch (_) {}
    cards = DEMO.slice();
  }
  function emit() { save(); subs.forEach(function (fn) { try { fn(); } catch (_) {} }); }

  load();

  global.hawkrCards = {
    list: function () { return cards.slice(); },
    get: function (id) { return cards.filter(function (c) { return c.id === id; })[0] || null; },
    add: function (card) { cards.push(card); emit(); return card; },
    remove: function (id) {
      var n = cards.length;
      cards = cards.filter(function (c) { return c.id !== id; });
      if (cards.length !== n) emit();
    },
    onChange: function (fn) { if (typeof fn === "function") subs.push(fn); }
  };
})(window);
