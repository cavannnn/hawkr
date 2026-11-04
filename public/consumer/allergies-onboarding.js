/* allergies-onboarding.js — onboarding allergy picker (#view-allergies). */
(function () {
  "use strict";

  var ALLERGENS = window.HAWKR_ALLERGENS || [];

  document.addEventListener("DOMContentLoaded", function () {
    var view = document.getElementById("view-allergies");
    if (!view) return;

    var list = view.querySelector(".allergy-list");
    var next = view.querySelector(".allergies-next");
    var otherInput = view.querySelector(".allergy-other__input");

    var selected = new Set(); // curated allergen ids
    var customs = [];         // free-text allergens (out-of-vocab), parsed from otherInput

    /* ---- Render the list from the registry ---- */
    window.renderAllergenPicks(list);

    function syncNext() { next.disabled = !(selected.size || customs.length); }

    /* ---- Selection ---- */
    list.addEventListener("click", function (e) {
      var chip = e.target.closest(".allergy-pick");
      if (!chip) return;
      var id = chip.dataset.allergen;
      var on = !selected.has(id);
      selected[on ? "add" : "delete"](id);
      chip.classList.toggle("is-selected", on);
      chip.setAttribute("aria-pressed", String(on));
      syncNext();
    });

    otherInput.addEventListener("input", function () {
      customs = otherInput.value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
      syncNext();
    });

    /* ---- Storing the answer ---- */
    function storeAnswer(allergens, customAllergens) {
      if (window.hawkrProfile) hawkrProfile.set({ allergens: allergens, customAllergens: customAllergens });
      if (window.hawkrPrefs && hawkrPrefs.isMember()) {
        hawkrPrefs.saveAllergens(allergens, customAllergens).catch(function (err) {
          console.warn("Onboarding: allergens not saved to the account —", err && err.message);
        });
      }
    }

    view.querySelector("[data-allergies-back]").addEventListener("click", function () { history.back(); });
    next.addEventListener("click", function () {
      if (next.disabled) return;
      storeAnswer(Array.from(selected), customs.slice());
      navigate("home");
    });
    view.querySelector(".allergies-none").addEventListener("click", function () {
      selected.clear();
      customs = [];
      otherInput.value = "";
      list.querySelectorAll(".allergy-pick.is-selected").forEach(function (el) {
        el.classList.remove("is-selected");
        el.setAttribute("aria-pressed", "false");
      });
      syncNext();
      storeAnswer([], []);
      navigate("home");
    });
  });
})();
