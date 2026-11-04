(function (global, doc) {
  "use strict";

  var REDUCE = matchMedia("(prefers-reduced-motion:reduce)").matches;

  function setText(root, sel, txt) { var el = root.querySelector(sel); if (el) el.textContent = txt; }
  function setAvatar(el, av) { if (!el || !av) return; if (av.gradient) el.style.background = av.gradient; el.textContent = av.letter; }

  function fillDiscs(box) {
    if (!box) return;
    var all = (global.HAWKR_ALLERGENS || []).slice(0, 3); // 3 representative discs (Figma shows 3)
    box.innerHTML = all.map(function (a) {
      return '<span class="pf-disc" style="background-color:' + a.bg + ';background-image:url(../images/' + a.img + ')"></span>';
    }).join("");
  }

  function fill() {
    var view = doc.getElementById("view-profile");
    if (!view || !global.hawkrProfile) return;
    var name = hawkrProfile.displayName() || "Guest";
    var av = hawkrProfile.avatar();
    var pr = hawkrProfile.get() || {};

    setText(view, ".pf-name", name);
    setAvatar(view.querySelector(".pf-avatar"), av);
    setText(view, ".pf-greet-name", name);
    setAvatar(view.querySelector(".pf-greet-av"), av);
    if (pr.since) setText(view, ".pf-since", "Since " + pr.since); // else keep the "Since 2026" fallback
    var orders = pr.orders && pr.orders > 0 ? pr.orders : 20;
    setText(view, ".pf-orders", String(orders));
    var loginBtn = view.querySelector("[data-auth-login]");
    if (loginBtn) loginBtn.hidden = !!pr.signedUp;
    fillDiscs(view.querySelector(".pf-discs"));
  }

  doc.addEventListener("DOMContentLoaded", function () {
    var view = doc.getElementById("view-profile");
    if (!view) return;
    fill();

    if (typeof autoHideBar === "function") autoHideBar(view, view.querySelector(".pf-bar"), "pf-bar--hidden", { hideAfter: 64 });

    view.addEventListener("click", function (e) {
      if (e.target.closest("[data-profile-back]")) { history.back(); return; }
      if (e.target.closest("[data-menu]")) { // open the drawer via a sidebar-wired menu button
        var m = doc.querySelector('#view-home button[aria-label="Menu"], #view-store button[aria-label="Menu"]');
        if (m) m.click();
        return;
      }
      if (e.target.closest("[data-auth-login]")) {
        global.location.href = "/auth/login.html";
        return;
      }
      if (e.target.closest("[data-profile-join]")) { // SEAM: sign-up flow — route to the login/onboarding entry
        global.location.href = "/auth/login.html";
        return;
      }
    });

    var vids = [].slice.call(view.querySelectorAll(".pf-video"));
    function sync() {
      var on = doc.body.dataset.view === "profile";
      vids.forEach(function (v) {
        if (on && !REDUCE) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else { v.pause(); }
      });
      if (on) {
        fill(); // refresh identity/orders each time the page opens
        var bar = view.querySelector(".pf-bar");
        if (bar) bar.classList.remove("pf-bar--hidden"); // always arrive with the bar showing
      }
    }
    new MutationObserver(sync).observe(doc.body, { attributes: true, attributeFilter: ["data-view"] });
    sync();
  });
})(window, document);
