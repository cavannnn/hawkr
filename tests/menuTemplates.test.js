const { generateMenuForStall } = require("../models/menuTemplates");

describe("menuTemplates.generateMenuForStall", () => {
  it("should build a starter menu of no more than 60 items", () => {
    const menu = generateMenuForStall("Ah Hock Chicken Rice", null);

    expect(menu.length).toBeGreaterThan(0);
    expect(menu.length).toBeLessThanOrEqual(60);
  });

  it("should give every item a name, price, category and description", () => {
    const menu = generateMenuForStall("Ah Hock Chicken Rice", null);

    menu.forEach(item => {
      expect(typeof item.itemName).toBe("string");
      expect(item.itemName.length).toBeGreaterThan(0);
      expect(typeof item.price).toBe("number");
      expect(item.price).toBeGreaterThan(0);
      expect(typeof item.category).toBe("string");
      expect(typeof item.description).toBe("string");
    });
  });

  it("should match a template from the stall name", () => {
    const menu = generateMenuForStall("Ah Hock Chicken Rice", null);

    expect(menu.some(item => item.category === "Rice")).toBe(true);
  });

  it("should match a template from the cuisine type when the name gives nothing away", () => {
    const menu = generateMenuForStall("Stall 12", "nasi lemak");

    expect(menu.length).toBeGreaterThan(0);
    expect(menu.some(item => /nasi lemak/i.test(item.itemName))).toBe(true);
  });

  it("should still build a menu for an unrecognised stall", () => {
    const menu = generateMenuForStall("Unknown Stall", null);

    expect(menu.length).toBeGreaterThan(0);
    expect(menu.length).toBeLessThanOrEqual(60);
  });

  it("should never repeat an item name within one menu", () => {
    const menu = generateMenuForStall("Ah Hock Chicken Rice", null);
    const names = menu.map(item => item.itemName);

    expect(new Set(names).size).toBe(names.length);
  });

  it("should price every item to two decimal places", () => {
    const menu = generateMenuForStall("Ah Hock Chicken Rice", null);

    menu.forEach(item => {
      expect(item.price).toBe(Math.round(item.price * 100) / 100);
    });
  });
});
