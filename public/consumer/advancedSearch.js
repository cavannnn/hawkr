/* advancedSearch.js — the results-view "Advanced Search". */
(function () {
  "use strict";

  var FAR_KM = 3; // browse-scope beyond this from the pill → offer to move the pill

  function initAdvanced() {
    var wrap = document.getElementById("advSearch");
    if (!wrap) return;
    var chip = document.querySelector(".results-filters [data-advanced]");
    var locInput = wrap.querySelector(".adv-loc-input");
    var suggest = document.querySelector(".adv-suggest");

    /* ---- open / close the Location field ---- */
    function open() {
      wrap.classList.add("is-open");
      if (chip) chip.classList.add("is-active");
      setTimeout(function () { if (locInput) locInput.focus(); }, 420); // after the reveal settles
    }
    function close() {
      wrap.classList.remove("is-open");
      if (chip) chip.classList.remove("is-active");
      closeSuggest();
    }
    if (chip) chip.addEventListener("click", function () {
      wrap.classList.contains("is-open") ? close() : open();
    });

    wrap.addEventListener("click", function (e) {
      if (e.target.closest(".search-clear") && wrap.classList.contains("is-open")) {
        e.stopImmediatePropagation();
        e.preventDefault();
        close();
      }
    }, true);

    /* ---- Places autocomplete on the Location field ---- */
    var acTimer = null, preds = null;

    function closeSuggest() {
      if (suggest) { suggest.classList.remove("is-open"); suggest.innerHTML = ""; preds = null; }
    }

    if (locInput) {
      locInput.addEventListener("input", function () {
        var q = locInput.value.trim();
        clearTimeout(acTimer);
        if (q.length < 3) { closeSuggest(); return; }
        acTimer = setTimeout(function () { fetchLoc(q); }, 250); // debounce keystrokes
      });
      locInput.addEventListener("blur", function () { setTimeout(closeSuggest, 150); }); // let a pick land first
    }

    async function fetchLoc(q) {
      if (typeof ensurePlaces !== "function") return;
      try {
        var lib = await ensurePlaces();
        var res = await lib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: q,
          includedRegionCodes: ["sg"],
        });
        renderLoc((res && res.suggestions) || []);
      } catch (err) {
        console.warn("[hawkr] advanced-search autocomplete failed — is Places API (New) enabled?", err);
      }
    }

    function renderLoc(suggestions) {
      if (!suggest) return;
      preds = suggestions.filter(function (s) { return s.placePrediction; });
      if (!preds.length) { closeSuggest(); return; }
      suggest.innerHTML = preds.map(function (s, i) {
        var p = s.placePrediction;
        var main = (p.mainText && p.mainText.text) || (p.text && p.text.text) || "";
        var sub = (p.secondaryText && p.secondaryText.text) || "";
        return '<li class="adv-suggest__item" data-idx="' + i + '">' +
          '<span class="adv-suggest__main">' + main + "</span>" +
          (sub ? '<span class="adv-suggest__sub">' + sub + "</span>" : "") +
          "</li>";
      }).join("");
      suggest.classList.add("is-open");
    }

    if (suggest) suggest.addEventListener("mousedown", function (e) {
      var item = e.target.closest(".adv-suggest__item");
      if (item) { e.preventDefault(); pickLoc(+item.dataset.idx); } // mousedown + preventDefault = pick before blur
    });

    async function pickLoc(idx) {
      var s = preds && preds[idx];
      if (!s || !s.placePrediction) return;
      try {
        var place = s.placePrediction.toPlace();
        await place.fetchFields({ fields: ["location", "formattedAddress"] });
        var c = place.location;
        if (locInput && place.formattedAddress) locInput.value = place.formattedAddress;
        closeSuggest();
        checkFar({ address: place.formattedAddress, lat: c.lat(), lng: c.lng() });
      } catch (err) {
        console.warn("[hawkr] advanced-search place details failed", err);
      }
    }

    /* ---- distance gate → far modal ---- */
    function shortName(addr) {
      return (addr || "").replace(/,?\s*Singapore(\s+\d{5,6})?\s*$/i, "").split(",")[0].trim() || addr;
    }
    function haversineKm(a, b) {
      var R = 6371, toRad = Math.PI / 180;
      var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
      var h = Math.sin(dLat / 2) ** 2 +
        Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    async function pillCoords() {
      var saved = (typeof loadSaved === "function") ? loadSaved() : null;
      if (!saved || !saved.address) return null; // no pill set → nothing to reconcile against
      if (saved.lat != null && saved.lng != null) {
        return { lat: saved.lat, lng: saved.lng, address: saved.address };
      }
      // pill was saved without coords (e.g. a previous "Update pill") → geocode the address
      try {
        var g = await google.maps.importLibrary("geocoding");
        var r = await new g.Geocoder().geocode({
          address: saved.address,
          componentRestrictions: { country: "sg" },
        });
        var loc = r && r.results && r.results[0] && r.results[0].geometry.location;
        return loc ? { lat: loc.lat(), lng: loc.lng(), address: saved.address } : null;
      } catch (e) {
        return null;
      }
    }
    async function checkFar(browsed) {
      var pill = await pillCoords();
      if (!pill) return;
      if (haversineKm(pill, browsed) > FAR_KM && typeof showFarModal === "function") {
        showFarModal(shortName(browsed.address), shortName(pill.address), { lat: browsed.lat, lng: browsed.lng });
      }
    }
  }

  document.addEventListener("DOMContentLoaded", initAdvanced);
})();
