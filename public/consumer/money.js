(function (global) {
  "use strict";

  function cents(v) {
    if (typeof v === "number") return Math.round(v * 100);
    return Math.round((parseFloat(String(v == null ? "" : v).replace(/[^0-9.]/g, "")) || 0) * 100);
  }

  function format(c) {
    return "$" + ((c || 0) / 100).toLocaleString("en-SG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function plus(d) { return "+" + ((Math.round((d || 0) * 100)) / 100).toFixed(2); }

  function roundUpDelta(c) { return (100 - ((c || 0) % 100)) % 100; }

  global.hawkrMoney = { cents: cents, format: format, plus: plus, roundUpDelta: roundUpDelta };
})(window);
