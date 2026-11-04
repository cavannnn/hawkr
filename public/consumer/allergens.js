window.HAWKR_ALLERGENS = [
  { id: "seafood", name: "Seafood", bg: "#eff6ff", img: "allergen-seafood.svg" },
  { id: "crab",    name: "Crab",    bg: "#fff2f1", img: "allergen-crab.svg" },
  { id: "gluten",  name: "Gluten",  bg: "#f1fcf3", img: "allergen-gluten.svg" },
  { id: "nuts",    name: "Nuts",    bg: "#f8f6ee", img: "allergen-nuts.svg" },
  { id: "dairy",   name: "Dairy",   bg: "#341539", img: "allergen-dairy.svg" },
  { id: "eggs",    name: "Eggs",    bg: "#fffbeb", img: "allergen-egg.svg" },
  { id: "soy",     name: "Soy",     bg: "#f7fee7", img: "allergen-soy.svg" },
];

/* The PICKER MARKUP, once. */
window.renderAllergenPicks = function (container, selected) {
  if (!container) return;
  var has = {};
  (selected || []).forEach(function (id) { has[id] = true; });

  container.innerHTML = window.HAWKR_ALLERGENS.map(function (a) {
    var on = !!has[a.id];
    return '<button class="allergy-pick' + (on ? " is-selected" : "") + '" type="button" ' +
        'data-allergen="' + a.id + '" aria-pressed="' + on + '">' +
      '<span class="allergy-pick__disc" style="background-color:' + a.bg +
        ";background-image:url(../images/" + a.img + ')"></span>' +
      '<span class="allergy-pick__label">' + a.name + "</span>" +
      '<img class="allergy-pick__check" src="../images/check.svg" alt="">' +
    "</button>";
  }).join("");
};
