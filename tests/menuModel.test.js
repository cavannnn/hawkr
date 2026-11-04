const MenuModel = require("../models/menuModel");
const PromotionModel = require("../models/promotionModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");
jest.mock("../models/promotionModel");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("MenuModel.findByStallId", () => {
  it("should return the stall's available items", async () => {
    const items = [{ menu_id: 1, item_name: "Chicken Rice", price: 4.5 }];
    const { request } = mockPool(rows(items));
    PromotionModel.getActivePromotionsForStall.mockResolvedValue([]);

    const result = await MenuModel.findByStallId(3);

    expect(request.input).toHaveBeenCalledWith("stallId", sql.Int, 3);
    expect(result).toEqual(items);
  });

  it("should narrow the query by hawker centre when one is given", async () => {
    const { request } = mockPool(rows([]));

    await MenuModel.findByStallId(3, 1);

    expect(request.input).toHaveBeenCalledWith("hawkerId", sql.Int, 1);
    expect(request.query.mock.calls[0][0]).toContain("s.centreId = @hawkerId");
  });

  it("should return early without pricing when the stall has no items", async () => {
    mockPool(rows([]));

    await expect(MenuModel.findByStallId(3)).resolves.toEqual([]);
    expect(PromotionModel.getActivePromotionsForStall).not.toHaveBeenCalled();
  });

  it("should apply active promotion pricing to each item", async () => {
    mockPool(rows([{ menu_id: 1, item_name: "Chicken Rice", price: 5, category: "Mains" }]));
    PromotionModel.getActivePromotionsForStall.mockResolvedValue([{ promotionId: 4 }]);
    PromotionModel.applyPromotionPricing.mockImplementation(item =>
      Object.assign({}, item, { price: 4.5, original_price: 5 })
    );

    const result = await MenuModel.findByStallId(3);

    expect(PromotionModel.applyPromotionPricing).toHaveBeenCalledTimes(1);
    expect(result[0].price).toBe(4.5);
  });

  it("should convert a query failure into a database error", async () => {
    mockPool(new Error("Connection lost"));

    await expect(MenuModel.findByStallId(3)).rejects.toThrow("Database error occurred");
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(MenuModel.findByStallId(3)).rejects.toThrow("Database Error");
  });
});

describe("MenuModel.findById", () => {
  it("should return the matching menu item", async () => {
    const { request } = mockPool(rows([{ menu_id: 1, item_name: "Chicken Rice" }]));

    const item = await MenuModel.findById(1);

    expect(request.input).toHaveBeenCalledWith("menuId", sql.Int, 1);
    expect(item).toEqual({ menu_id: 1, item_name: "Chicken Rice" });
  });

  it("should return null when the item does not exist", async () => {
    mockPool(rows([]));

    await expect(MenuModel.findById(999)).resolves.toBeNull();
  });
});

describe("MenuModel.findByCompositeKey", () => {
  it("should return the item priced at its promotion rate", async () => {
    mockPool(rows([{ menu_id: 1, item_name: "Chicken Rice", price: 5, stall_id: 3 }]));
    PromotionModel.getActivePromotionsForStall.mockResolvedValue([{ promotionId: 4 }]);
    PromotionModel.applyPromotionPricing.mockImplementation(item =>
      Object.assign({}, item, { price: 4.5, original_price: 5, promotion_id: 4 })
    );

    const item = await MenuModel.findByCompositeKey(1, 3, 1);

    expect(item.price).toBe(4.5);
    expect(item.promotion_id).toBe(4);
  });

  it("should return the item unchanged when no promotion is active", async () => {
    mockPool(rows([{ menu_id: 1, item_name: "Chicken Rice", price: 5 }]));
    PromotionModel.getActivePromotionsForStall.mockResolvedValue([]);

    const item = await MenuModel.findByCompositeKey(1, 3, 1);

    expect(item.price).toBe(5);
    expect(PromotionModel.applyPromotionPricing).not.toHaveBeenCalled();
  });

  it("should return null when the item is not in that stall", async () => {
    mockPool(rows([]));

    await expect(MenuModel.findByCompositeKey(1, 3, 999)).resolves.toBeNull();
    expect(PromotionModel.getActivePromotionsForStall).not.toHaveBeenCalled();
  });
});
