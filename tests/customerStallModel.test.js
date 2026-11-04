const StallModel = require("../models/customerStallModel");
const PromotionModel = require("../models/promotionModel");
const { pendingGradeFor } = require("../utils/grading");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");
jest.mock("../models/promotionModel");
jest.mock("../utils/grading");

beforeEach(() => {
  jest.clearAllMocks();
  pendingGradeFor.mockReturnValue(null);
  PromotionModel.getActivePromotionsForStall.mockResolvedValue([]);
});

function stallRow(overrides) {
  return Object.assign(
    {
      stall_id: 3,
      hawker_id: 1,
      stall_name: "Ah Hock Chicken Rice",
      nea_grade: "A",
      performance_start_date: "2023-01-01",
      menu_items: JSON.stringify([{ menu_id: 1, item_name: "Chicken Rice", price: 5 }])
    },
    overrides
  );
}

describe("customerStallModel.findAll", () => {
  it("should parse the nested menu JSON on every stall", async () => {
    mockPool(rows([stallRow()]));

    const stalls = await StallModel.findAll();

    expect(stalls[0].menu_items).toEqual([{ menu_id: 1, item_name: "Chicken Rice", price: 5 }]);
  });

  it("should default to an empty menu when the stall has none", async () => {
    mockPool(rows([stallRow({ menu_items: null })]));

    const stalls = await StallModel.findAll();

    expect(stalls[0].menu_items).toEqual([]);
  });

  it("should attach the derived pending grade", async () => {
    pendingGradeFor.mockReturnValue("B");
    mockPool(rows([stallRow()]));

    const stalls = await StallModel.findAll();

    expect(stalls[0].pending_grade).toBe("B");
  });

  it("should filter by hawker centre when asked", async () => {
    const { request } = mockPool(rows([]));

    await StallModel.findAll({ hawker_id: 1 });

    expect(request.input).toHaveBeenCalledWith("hawkerId", sql.Int, 1);
    expect(request.query.mock.calls[0][0]).toContain("s.centreId = @hawkerId");
  });

  it("should apply active promotion pricing to the menu", async () => {
    mockPool(rows([stallRow()]));
    PromotionModel.getActivePromotionsForStall.mockResolvedValue([{ promotionId: 4 }]);
    PromotionModel.applyPromotionPricing.mockImplementation(item =>
      Object.assign({}, item, { price: 4.5 })
    );

    const stalls = await StallModel.findAll();

    expect(stalls[0].menu_items[0].price).toBe(4.5);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(StallModel.findAll()).rejects.toThrow("Database Error");
  });
});

describe("customerStallModel.findById", () => {
  it("should return the stall with its menu parsed", async () => {
    const { request } = mockPool(rows([stallRow()]));

    const stall = await StallModel.findById(3);

    expect(request.input).toHaveBeenCalledWith("stallId", sql.Int, 3);
    expect(stall.menu_items).toHaveLength(1);
  });

  it("should narrow the lookup by hawker centre when one is given", async () => {
    const { request } = mockPool(rows([stallRow()]));

    await StallModel.findById(3, 1);

    expect(request.input).toHaveBeenCalledWith("hawkerId", sql.Int, 1);
  });

  it("should return null when the stall does not exist", async () => {
    mockPool(rows([]));

    await expect(StallModel.findById(999)).resolves.toBeNull();
  });
});

describe("customerStallModel.findByCompositeKey", () => {
  it("should look the stall up within its hawker centre", async () => {
    const { request } = mockPool(rows([stallRow()]));

    const stall = await StallModel.findByCompositeKey(1, 3);

    expect(request.input).toHaveBeenCalledWith("stallId", sql.Int, 3);
    expect(request.input).toHaveBeenCalledWith("hawkerId", sql.Int, 1);
    expect(stall.stall_id).toBe(3);
  });

  it("should return null when the stall is not in that centre", async () => {
    mockPool(rows([]));

    await expect(StallModel.findByCompositeKey(9, 3)).resolves.toBeNull();
  });
});
