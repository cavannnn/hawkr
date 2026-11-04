/* allergens.js — the server's allergen vocabulary. */

const ALLERGEN_IDS = ['seafood', 'crab', 'gluten', 'nuts', 'dairy', 'eggs', 'soy'];

// Membership test used to split a stored set into standard vs custom. Derived rather than
// stored as a column, so the flag can never disagree with the list above.
function isStandardAllergen(name) {
  return ALLERGEN_IDS.includes(name);
}

module.exports = { ALLERGEN_IDS, isStandardAllergen };
