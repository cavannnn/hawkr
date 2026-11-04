const centrePromotionModel = require("../models/centrePromotionModel");
const NotificationModel = require("../models/notificationModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");
jest.mock("../models/notificationModel");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("centrePromotionModel.getActiveStallsForHawker", () => {
  it("should list the centre's active stalls", async () => {
    const stalls = [{ StallId: 3, StallName: "Ah Hock" }];
    const { request } = mockPool(rows(stalls));

    const result = await centrePromotionModel.getActiveStallsForHawker(1);

    expect(request.input).toHaveBeenCalledWith("HawkerId", sql.Int, 1);
    expect(result).toEqual(stalls);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(centrePromotionModel.getActiveStallsForHawker(1)).rejects.toThrow("Database Error");
  });
});

describe("centrePromotionModel.getPromotionsForHawker", () => {
  it("should return each promotion with its targeted stall count", async () => {
    const promotions = [{ PromotionId: 4, TargetedStallCount: 2 }];
    mockPool(rows(promotions));

    await expect(centrePromotionModel.getPromotionsForHawker(1)).resolves.toEqual(promotions);
  });
});

describe("centrePromotionModel.getPromotionById", () => {
  it("should return the matching promotion", async () => {
    mockPool(rows([{ PromotionId: 4 }]));

    await expect(centrePromotionModel.getPromotionById(4)).resolves.toEqual({ PromotionId: 4 });
  });

  it("should return undefined for an unknown id", async () => {
    mockPool(rows([]));

    await expect(centrePromotionModel.getPromotionById(999)).resolves.toBeUndefined();
  });
});

describe("centrePromotionModel.getTargetedStalls", () => {
  it("should list the stalls a promotion targets", async () => {
    const stalls = [{ StallId: 3, StallName: "Ah Hock" }];
    mockPool(rows(stalls));

    await expect(centrePromotionModel.getTargetedStalls(4)).resolves.toEqual(stalls);
  });
});

describe("centrePromotionModel.createPromotion", () => {
  it("should insert the promotion, link the stalls and notify the vendors", async () => {
    mockPool([
      rows([{ PromotionId: 4 }]),
      rows([]),
      rows([]),
      rows([{ vendorId: 5 }])
    ]);

    const promotionId = await centrePromotionModel.createPromotion(
      { HawkerId: 1, Name: "Centre Deal", DiscountType: "percentage", DiscountValue: 10, CreatedByOperatorId: 2 },
      [3, 6]
    );

    expect(promotionId).toBe(4);
    expect(NotificationModel.createNotification).toHaveBeenCalledWith(
      5,
      "centre_promotion",
      "New hawker-centre-wide promotion",
      expect.stringContaining("Centre Deal"),
      "storePromotions.html",
      "centrePromotion",
      4
    );
  });

  it("should expand the all target to every active stall in the centre", async () => {
    mockPool([
      rows([{ PromotionId: 5 }]),
      rows([{ StallId: 3 }, { StallId: 6 }]),
      rows([]),
      rows([]),
      rows([])
    ]);

    const promotionId = await centrePromotionModel.createPromotion(
      { HawkerId: 1, Name: "Everything Deal", CreatedByOperatorId: 2 },
      "all"
    );

    expect(promotionId).toBe(5);
  });

  it("should not notify anybody when no stalls are targeted", async () => {
    mockPool(rows([{ PromotionId: 6 }]));

    await centrePromotionModel.createPromotion({ HawkerId: 1, Name: "Empty", CreatedByOperatorId: 2 }, []);

    expect(NotificationModel.createNotification).not.toHaveBeenCalled();
  });
});

describe("centrePromotionModel.clonePromotion", () => {
  it("should copy the promotion into the target centre", async () => {
    const { request } = mockPool(rows([{ PromotionId: 5 }]));

    const newId = await centrePromotionModel.clonePromotion(
      { Name: "Centre Deal", Description: "10% off", DiscountType: "percentage", DiscountValue: 10 },
      2,
      2
    );

    expect(request.input).toHaveBeenCalledWith("HawkerId", sql.Int, 2);
    expect(newId).toBe(5);
  });
});

describe("centrePromotionModel.stallsBelongToHawker", () => {
  it("should return true when every stall matches the centre", async () => {
    mockPool(rows([{ MatchCount: 2 }]));

    await expect(centrePromotionModel.stallsBelongToHawker([3, 6], 1)).resolves.toBe(true);
  });

  it("should return false when a stall belongs elsewhere", async () => {
    mockPool(rows([{ MatchCount: 1 }]));

    await expect(centrePromotionModel.stallsBelongToHawker([3, 99], 1)).resolves.toBe(false);
  });

  it("should treat an empty stall list as valid without querying", async () => {
    await expect(centrePromotionModel.stallsBelongToHawker([], 1)).resolves.toBe(true);
    expect(sql.connect).not.toHaveBeenCalled();
  });
});

describe("centrePromotionModel.getPromotionStallMap", () => {
  it("should group stall ids by promotion", async () => {
    mockPool(rows([
      { PromotionId: 4, StallId: 3 },
      { PromotionId: 4, StallId: 6 },
      { PromotionId: 5, StallId: 3 }
    ]));

    const map = await centrePromotionModel.getPromotionStallMap(1);

    expect(map.get(4)).toEqual([3, 6]);
    expect(map.get(5)).toEqual([3]);
  });

  it("should return an empty map when nothing is targeted", async () => {
    mockPool(rows([]));

    const map = await centrePromotionModel.getPromotionStallMap(1);

    expect(map.size).toBe(0);
  });
});

describe("centrePromotionModel.getPromotionsForStall", () => {
  it("should list the centre promotions applying to one stall", async () => {
    const promotions = [{ PromotionId: 4 }];
    const { request } = mockPool(rows(promotions));

    const result = await centrePromotionModel.getPromotionsForStall(3);

    expect(request.input).toHaveBeenCalledWith("StallId", sql.Int, 3);
    expect(result).toEqual(promotions);
  });
});
