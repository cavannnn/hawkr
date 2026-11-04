const { ALLERGEN_IDS, isStandardAllergen } = require("../config/allergens");
const { CUISINE_NAMES, MAX_CUISINES, isKnownCuisine } = require("../config/cuisines");

describe("config/allergens", () => {
  it("should list the server's standard allergens", () => {
    expect(ALLERGEN_IDS).toEqual(["seafood", "crab", "gluten", "nuts", "dairy", "eggs", "soy"]);
  });

  it("should recognise a standard allergen", () => {
    expect(isStandardAllergen("nuts")).toBe(true);
  });

  it("should treat anything else as custom", () => {
    expect(isStandardAllergen("durian")).toBe(false);
  });

  it("should be case sensitive", () => {
    expect(isStandardAllergen("Nuts")).toBe(false);
  });
});

describe("config/cuisines", () => {
  it("should list the cuisines a customer can pick from", () => {
    expect(CUISINE_NAMES).toContain("Malay");
    expect(CUISINE_NAMES).toContain("Japanese");
  });

  it("should cap a palette at five cuisines", () => {
    expect(MAX_CUISINES).toBe(5);
  });

  it("should recognise a known cuisine", () => {
    expect(isKnownCuisine("Thai")).toBe(true);
  });

  it("should reject a cuisine outside the vocabulary", () => {
    expect(isKnownCuisine("Martian")).toBe(false);
  });
});
