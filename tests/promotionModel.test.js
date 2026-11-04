const Promotion = require("../models/promotionModel");
const sql = require("mssql");
const { mockTaggedQuery, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("promotionModel.getPromotionsByStall", () => {
  it("should flatten the scoped menu id JSON", async () => {
    mockTaggedQuery(rows([
      { promotionId: 4, name: "Lunch Deal", scopeMenuIds: JSON.stringify([{ menuId: 1 }, { menuId: 2 }]) }
    ]));

    const promotions = await Promotion.getPromotionsByStall(3);

    expect(promotions[0].scopeMenuIds).toEqual([1, 2]);
  });

  it("should default to an empty scope list", async () => {
    mockTaggedQuery(rows([{ promotionId: 4, name: "Lunch Deal", scopeMenuIds: null }]));

    const promotions = await Promotion.getPromotionsByStall(3);

    expect(promotions[0].scopeMenuIds).toEqual([]);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database Error"));

    await expect(Promotion.getPromotionsByStall(3)).rejects.toThrow("Database Error");
  });
});

describe("promotionModel.addPromotion", () => {
  it("should insert the promotion and return true", async () => {
    mockTaggedQuery(rows([{ promotionId: 4 }]));

    await expect(
      Promotion.addPromotion(5, 3, {
        name: "Lunch Deal",
        discountType: "percentage",
        discountValue: 10,
        scopeType: "all",
        isActive: true,
        startDate: "2026-01-01",
        endDate: "2026-12-31"
      })
    ).resolves.toBe(true);
    expect(sql.query).toHaveBeenCalledTimes(1);
  });

  it("should link the chosen menu items for an item-scoped promotion", async () => {
    mockTaggedQuery([rows([{ promotionId: 4 }]), affected(1), affected(1), affected(1)]);

    await Promotion.addPromotion(5, 3, {
      name: "Combo Deal",
      discountType: "fixed",
      discountValue: 1,
      scopeType: "items",
      scopeMenuIds: [1, 2],
      isActive: true,
      startDate: "2026-01-01",
      endDate: "2026-12-31"
    });

    expect(sql.query).toHaveBeenCalledTimes(4);
  });
});

describe("promotionModel.updatePromotion", () => {
  it("should update the promotion and rewrite its item links", async () => {
    mockTaggedQuery([affected(1), affected(1)]);

    await expect(
      Promotion.updatePromotion(3, 4, {
        name: "Lunch Deal",
        discountType: "percentage",
        discountValue: 15,
        scopeType: "all",
        isActive: true,
        startDate: "2026-01-01",
        endDate: "2026-12-31"
      })
    ).resolves.toBe(true);
  });

  it("should return false when no promotion matched", async () => {
    mockTaggedQuery(affected(0));

    await expect(
      Promotion.updatePromotion(3, 99, {
        name: "Lunch Deal",
        discountType: "percentage",
        discountValue: 15,
        scopeType: "all",
        isActive: true,
        startDate: "2026-01-01",
        endDate: "2026-12-31"
      })
    ).resolves.toBe(false);
  });
});

describe("promotionModel.deletePromotion", () => {
  it("should clear the item links and order references before deleting", async () => {
    mockTaggedQuery([affected(1), affected(1), affected(1)]);

    await expect(Promotion.deletePromotion(3, 4)).resolves.toBe(true);
    expect(sql.query).toHaveBeenCalledTimes(3);
  });

  it("should return false when the promotion is not the stall's", async () => {
    mockTaggedQuery([affected(1), affected(1), affected(0)]);

    await expect(Promotion.deletePromotion(3, 99)).resolves.toBe(false);
  });
});

describe("promotionModel.getActivePromotionsForStall", () => {
  it("should flatten the scoped menu id JSON", async () => {
    mockTaggedQuery(rows([
      { promotionId: 4, scopeType: "items", scopeMenuIds: JSON.stringify([{ menuId: 7 }]) }
    ]));

    const promotions = await Promotion.getActivePromotionsForStall(3);

    expect(promotions[0].scopeMenuIds).toEqual([7]);
  });

  it("should return an empty list when nothing is running", async () => {
    mockTaggedQuery(rows([]));

    await expect(Promotion.getActivePromotionsForStall(3)).resolves.toEqual([]);
  });
});

describe("promotionModel.applyPromotionPricing", () => {
  const item = { menuId: 1, price: 10, category: "Mains" };

  it("should leave the item untouched when nothing applies", () => {
    const priced = Promotion.applyPromotionPricing(item, []);

    expect(priced).toEqual(item);
  });

  it("should apply a percentage discount that covers everything", () => {
    const priced = Promotion.applyPromotionPricing(item, [
      { promotionId: 4, name: "Lunch Deal", scopeType: "all", discountType: "percentage", discountValue: 20, scopeMenuIds: [] }
    ]);

    expect(priced.price).toBe(8);
    expect(priced.original_price).toBe(10);
    expect(priced.discount_percent).toBe(20);
    expect(priced.promotion_name).toBe("Lunch Deal");
  });

  it("should apply a fixed discount", () => {
    const priced = Promotion.applyPromotionPricing(item, [
      { promotionId: 4, name: "Dollar Off", scopeType: "all", discountType: "fixed", discountValue: 2.5, scopeMenuIds: [] }
    ]);

    expect(priced.price).toBe(7.5);
  });

  it("should never price an item below zero", () => {
    const priced = Promotion.applyPromotionPricing(item, [
      { promotionId: 4, name: "Giveaway", scopeType: "all", discountType: "fixed", discountValue: 50, scopeMenuIds: [] }
    ]);

    expect(priced.price).toBe(0);
  });

  it("should prefer an item-scoped promotion over a centre-wide one", () => {
    const priced = Promotion.applyPromotionPricing(item, [
      { promotionId: 4, name: "Everything", scopeType: "all", discountType: "percentage", discountValue: 50, scopeMenuIds: [] },
      { promotionId: 5, name: "This Item", scopeType: "items", discountType: "percentage", discountValue: 10, scopeMenuIds: [1] }
    ]);

    expect(priced.promotion_id).toBe(5);
    expect(priced.price).toBe(9);
  });

  it("should prefer a category promotion over an all-items one", () => {
    const priced = Promotion.applyPromotionPricing(item, [
      { promotionId: 4, name: "Everything", scopeType: "all", discountType: "percentage", discountValue: 50, scopeMenuIds: [] },
      { promotionId: 6, name: "Mains", scopeType: "category", scopeCategory: "mains", discountType: "percentage", discountValue: 5, scopeMenuIds: [] }
    ]);

    expect(priced.promotion_id).toBe(6);
  });

  it("should pick the deeper discount when two promotions share a scope", () => {
    const priced = Promotion.applyPromotionPricing(item, [
      { promotionId: 4, name: "Small", scopeType: "all", discountType: "percentage", discountValue: 10, scopeMenuIds: [] },
      { promotionId: 5, name: "Big", scopeType: "all", discountType: "percentage", discountValue: 30, scopeMenuIds: [] }
    ]);

    expect(priced.promotion_id).toBe(5);
  });

  it("should ignore a promotion scoped to a different item", () => {
    const priced = Promotion.applyPromotionPricing(item, [
      { promotionId: 5, name: "Other Item", scopeType: "items", discountType: "percentage", discountValue: 50, scopeMenuIds: [99] }
    ]);

    expect(priced).toEqual(item);
  });

  it("should ignore a promotion scoped to a different category", () => {
    const priced = Promotion.applyPromotionPricing(item, [
      { promotionId: 6, name: "Drinks", scopeType: "category", scopeCategory: "Drinks", discountType: "percentage", discountValue: 50, scopeMenuIds: [] }
    ]);

    expect(priced).toEqual(item);
  });
});
