const CUISINE_NAMES = [
  'Western',
  'Indian',
  'Malay',
  'Thai',
  'Chinese',
  'Korean',
  'Japanese',
  'Pizza',
];

const MAX_CUISINES = 5;

function isKnownCuisine(name) {
  return CUISINE_NAMES.includes(name);
}

module.exports = { CUISINE_NAMES, MAX_CUISINES, isKnownCuisine };
