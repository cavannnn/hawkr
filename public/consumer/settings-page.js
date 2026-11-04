(function (global, doc) {
  "use strict";

  var REDUCE = matchMedia("(prefers-reduced-motion:reduce)").matches;

  var Cards = global.hawkrCards;

  var details = { password: "••••••••••••", email: "—", phone: "—" };
  var detailsLoadedFor = null;

  function view() { return doc.getElementById("view-settings"); }
  function setText(root, sel, txt) { var el = root.querySelector(sel); if (el) el.textContent = txt; }

  function session() {
    try {
      var token = localStorage.getItem("authToken");
      var userId = localStorage.getItem("userId");
      if (!token || !userId) return null;
      return { token: token, userId: userId };
    } catch (_) { return null; }
  }

  function formatPhone(raw) {
    var digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.length === 8) return "+65 " + digits.slice(0, 4) + " " + digits.slice(4);
    return String(raw);
  }

  function loadDetails() {
    var s = session();
    if (!s) {
      details.email = "—";
      details.phone = "—";
      detailsLoadedFor = null;
      return;
    }
    if (detailsLoadedFor === s.userId) return;
    detailsLoadedFor = s.userId;

    fetch("/api/customers/" + encodeURIComponent(s.userId), {
      headers: { Authorization: "Bearer " + s.token }
    })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (body) {
        var d = body && body.data;
        if (!d) return;
        details.email = d.email || "Not set";
        details.phone = d.phone ? formatPhone(d.phone) : "Not set";
        fill();
      })
      .catch(function () {
        detailsLoadedFor = null;
      });
  }

  /* ---------------- fill from the profile ---------------- */
  function fill() {
    var v = view();
    if (!v || !global.hawkrProfile) return;
    loadDetails();
    var pr = hawkrProfile.get() || {};
    var name = hawkrProfile.displayName() || "Member";
    var av = hawkrProfile.avatar();

    setText(v, ".st-name", name);
    var avEl = v.querySelector(".st-avatar");
    if (avEl && av) { if (av.gradient) avEl.style.background = av.gradient; avEl.textContent = av.letter; }
    setText(v, ".st-orders", (pr.orders || 0) + (pr.orders === 1 ? " Order" : " Orders"));
    if (pr.since) setText(v, ".st-since", "Since " + pr.since);

    setText(v, '[data-field="name"]', name);
    setText(v, '[data-field="password"]', details.password);
    setText(v, '[data-field="email"]', details.email);
    setText(v, '[data-field="phone"]', details.phone);
  }

  /* ---------------- payment cards ---------------- */
  function cardHtml(c) {
    return '<div class="st-pcard st-pcard--' + c.brand + '" data-card="' + c.id + '">' +
      '<button class="st-pcard__del" type="button" data-card-del="' + c.id + '" aria-label="Remove card ending ' + c.last4 + '">&minus;</button>' +
      '<img class="st-pcard__mark" src="../images/card-watermark.svg" alt="" aria-hidden="true">' +
      '<img class="st-pcard__logo" src="../images/' + c.logo + '" alt="' + c.brand + '">' +
      '<div><div class="st-pcard__num">&bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; ' + c.last4 + '</div>' +
      '<div class="st-pcard__exp">Exp ' + c.exp + "</div></div></div>";
  }
  function renderCards() {
    var box = view() && view().querySelector("[data-cards]");
    if (!box) return;
    var list = Cards.list();
    box.innerHTML = list.length ? list.map(cardHtml).join("")
      : '<p class="st-cards__empty">No saved cards yet. Add one for faster checkout.</p>';
  }

  function flip(box, mutate) {
    var cards = [].slice.call(box.querySelectorAll(".st-pcard"));
    if (REDUCE || !cards.length) { mutate(); return; }
    var first = cards.map(function (el) { return el.getBoundingClientRect(); });
    mutate();
    var last = cards.map(function (el) { return el.getBoundingClientRect(); });
    cards.forEach(function (el, i) {
      var dx = first[i].left - last[i].left;
      var dy = first[i].top - last[i].top;
      var sx = first[i].width / (last[i].width || 1);
      if (!dx && !dy && Math.abs(sx - 1) < 0.01) return;
      el.style.transition = "none";
      el.style.transformOrigin = "top left";
      el.style.transform = "translate(" + dx + "px," + dy + "px) scaleX(" + sx + ")";
      requestAnimationFrame(function () {
        el.style.transition = "";
        el.style.transform = "";
      });
    });
  }

  function setCardsEditing(on) {
    var v = view(); if (!v) return;
    var box = v.querySelector("[data-cards]");
    var btn = v.querySelector("[data-cards-edit]");
    flip(box, function () { box.classList.toggle("is-editing", on); });
    btn.classList.toggle("is-active", on);
    btn.querySelector(".st-chip__label").textContent = on ? "Done" : "Edit";
    var icon = btn.querySelector(".st-chip__icon");
    if (icon) icon.style.display = on ? "none" : "";
  }

  function removeCard(id) {
    var v = view(); if (!v) return;
    var box = v.querySelector("[data-cards]");
    var el = box.querySelector('[data-card="' + id + '"]');
    if (!el) return;
    var drop = function () {
      Cards.remove(id);
      var editing = box.classList.contains("is-editing");
      var cards = [].slice.call(box.querySelectorAll(".st-pcard")).filter(function (n) { return n !== el; });
      var first = cards.map(function (n) { return { id: n.dataset.card, r: n.getBoundingClientRect() }; });
      renderCards();
      if (editing) box.classList.add("is-editing");
      if (!REDUCE) {
        first.forEach(function (m) {
          var n = box.querySelector('[data-card="' + m.id + '"]');
          if (!n) return;
          var r = n.getBoundingClientRect();
          var dy = m.r.top - r.top, dx = m.r.left - r.left;
          if (!dx && !dy) return;
          n.style.transition = "none";
          n.style.transform = "translate(" + dx + "px," + dy + "px)";
          requestAnimationFrame(function () { n.style.transition = ""; n.style.transform = ""; });
        });
      }
    };
    if (REDUCE) { drop(); return; }
    el.classList.add("is-removing");           // shrink + fade the doomed card…
    setTimeout(drop, 240);                      // …then reflow the rest into the gap
  }

  /* ---------------- personal details inline edit ---------------- */
  var editing = false;
  var FIELDS = [
    { key: "name", type: "text" },
    { key: "password", type: "password" },
    { key: "email", type: "email" },
    { key: "phone", type: "tel" },
  ];
  function setDetailsEditing(on) {
    var v = view(); if (!v) return;
    editing = on;
    var btn = v.querySelector("[data-details-edit]");
    btn.classList.toggle("is-active", on);
    btn.querySelector(".st-chip__label").textContent = on ? "Save" : "Edit";
    var icon = btn.querySelector(".st-chip__icon");
    if (icon) icon.style.display = on ? "none" : "";

    FIELDS.forEach(function (f) {
      var cell = v.querySelector('[data-field="' + f.key + '"]');
      if (!cell) return;
      if (on) {
        var cur = f.key === "name" ? (hawkrProfile.displayName() || "") : details[f.key];
        if (f.key === "password") cur = ""; // never prefill a password field with the mask
        cell.innerHTML = '<input class="st-input" type="' + f.type + '" value="' + String(cur).replace(/"/g, "&quot;") +
          '" placeholder="' + (f.key === "password" ? "New password" : "") + '" aria-label="' + f.key + '">';
      } else {
        var input = cell.querySelector(".st-input");
        if (input) {
          var val = input.value.trim();
          if (f.key === "name") { if (val) hawkrProfile.set({ name: val }); }          // applies immediately (demo)
          else if (f.key === "password") { if (val) details.password = "••••••••••••"; } // store the mask, not the value
          else if (val) details[f.key] = val;
        }
        cell.textContent = "";
      }
    });
    if (!on) fill(); // re-render the saved values (and the identity card, if the name changed)
  }

  /* ---------------- delete-account confirm sheet ---------------- */
  var reason = null;
  function confirmEl() { return doc.getElementById("st-confirm"); }
  function openConfirm() {
    var m = confirmEl(); if (!m) return;
    reason = null;
    m.querySelectorAll(".st-reason").forEach(function (b) { b.classList.remove("is-selected"); b.setAttribute("aria-checked", "false"); });
    m.querySelector("[data-confirm-delete]").disabled = true;
    global.openSheet(m); // the shared primitive in app.js — this used to be a copy of it
  }
  function closeConfirm() { global.closeSheet(confirmEl()); }

  /* ---------------- wiring ---------------- */
  doc.addEventListener("DOMContentLoaded", function () {
    var v = view();
    if (!v) return;
    renderCards();
    fill();

    if (typeof autoHideBar === "function") autoHideBar(v, v.querySelector(".st-bar"), "st-bar--hidden", { hideAfter: 64 });

    v.addEventListener("click", function (e) {
      if (e.target.closest("[data-settings-back]")) { history.back(); return; }
      if (e.target.closest("[data-menu]")) {
        var m = doc.querySelector('#view-home button[aria-label="Menu"], #view-store button[aria-label="Menu"]');
        if (m) m.click();
        return;
      }
      if (e.target.closest("[data-settings-logout]")) {
        if (global.hawkrProfile) hawkrProfile.set({ signedUp: false, name: null, since: null });
        if (typeof navigate === "function") navigate("home");
        if (global.hawkrSession) global.hawkrSession.signOut();
        return;
      }
      if (e.target.closest("[data-details-edit]")) { setDetailsEditing(!editing); return; }
      if (e.target.closest("[data-cards-edit]")) {
        var box = v.querySelector("[data-cards]");
        setCardsEditing(!box.classList.contains("is-editing"));
        return;
      }
      var del = e.target.closest("[data-card-del]");
      if (del) { removeCard(del.getAttribute("data-card-del")); return; }
      if (e.target.closest("[data-card-add]")) { // SEAM: a real add-card sheet / Stripe element
        Cards.add({ id: "c" + Date.now(), brand: "visa", logo: "card-visa.svg",
                    last4: String(1000 + Math.floor(Math.random() * 8999)), exp: "01/30" });
        var editingNow = v.querySelector("[data-cards]").classList.contains("is-editing");
        renderCards();
        if (editingNow) v.querySelector("[data-cards]").classList.add("is-editing");
        return;
      }
      if (e.target.closest("[data-account-delete]")) { openConfirm(); return; }
    });

    // confirm sheet: pick a reason to arm the destructive button
    var m = confirmEl();
    if (m) {
      m.addEventListener("click", function (e) {
        var r = e.target.closest(".st-reason");
        if (r) {
          reason = r.getAttribute("data-reason");
          m.querySelectorAll(".st-reason").forEach(function (b) {
            var on = b === r;
            b.classList.toggle("is-selected", on);
            b.setAttribute("aria-checked", String(on));
          });
          m.querySelector("[data-confirm-delete]").disabled = false;
          return;
        }
        if (e.target.closest("[data-confirm-cancel]") || e.target.closest("[data-confirm-dismiss]")) { closeConfirm(); return; }
        if (e.target.closest("[data-confirm-delete]")) {
          if (!reason) return;
          // SEAM: DELETE /account. Demo: wipe the local identity → a brand-new guest.
          try { localStorage.removeItem("hawkr.guest"); } catch (_) {}
          closeConfirm();
          if (typeof navigate === "function") navigate("home");
          setTimeout(function () { location.reload(); }, 320); // remint a fresh guest cleanly
        }
      });
    }

    // refresh whenever the view is opened (orders/name may have changed elsewhere)
    new MutationObserver(function () {
      if (doc.body.dataset.view !== "settings") return;
      if (editing) setDetailsEditing(false);
      fill();
      var bar = v.querySelector(".st-bar");
      if (bar) bar.classList.remove("st-bar--hidden"); // always arrive with the bar showing
    }).observe(doc.body, { attributes: true, attributeFilter: ["data-view"] });
  });
})(window, document);
