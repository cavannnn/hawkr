(function (global) {
  "use strict";

  var HIDE_UNAVAILABLE = false; // flip to true once supported() is real (see above)

  var WALLETS = [
    { id: "applepay",  kind: "wallet", brand: true, label: "Check Out with Apple Pay",  icon: "applepay.svg" },
    { id: "googlepay", kind: "wallet", brand: true, label: "Check Out with Google Pay", icon: "googlepay.svg" },
    { id: "paynow",    kind: "wallet", label: "Pay with PayNow",  icon: "paynow.svg" },
    { id: "grabpay",   kind: "wallet", label: "Pay with GrabPay", icon: "grabpay.svg" },
    { id: "link",      kind: "wallet", label: "Pay with Link",    icon: "link.svg" },
  ];

  function settlesInPage(id) {
    try {
      if (id === "applepay") return !!(global.ApplePaySession && global.ApplePaySession.canMakePayments());
      if (id === "googlepay") return typeof global.PaymentRequest === "function";
    } catch (_) { return false; }
    return true;
  }

  function methods() {
    var wallets = WALLETS.filter(function (w) { return HIDE_UNAVAILABLE ? settlesInPage(w.id) : true; });
    wallets.sort(function (a, b) {
      if (!!a.brand !== !!b.brand) return a.brand ? -1 : 1;
      return (settlesInPage(b.id) ? 1 : 0) - (settlesInPage(a.id) ? 1 : 0);
    });

    var cards = (global.hawkrCards ? global.hawkrCards.list() : []).map(function (c) {
      return {
        id: c.id, kind: "card", brand: c.brand, last4: c.last4,
        icon: c.brand + ".svg",
        label: "Credit Card", sub: c.brand.charAt(0).toUpperCase() + c.brand.slice(1) + " " + c.last4
      };
    });
    return wallets.concat(cards);
  }

  function has(id) { return methods().some(function (m) { return m.id === id; }); }

  global.hawkrPay = { methods: methods, has: has, settlesInPage: settlesInPage };
})(window);
