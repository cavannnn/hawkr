const StallController = require("../controllers/customerStallController");
const StallModel = require("../models/customerStallModel");
const PromotionModel = require("../models/promotionModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/customerStallModel");
jest.mock("../models/promotionModel");

describe("customerStallController.getStallPromotions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should map each active promotion to the customer-facing shape", async () => {
    PromotionModel.getActivePromotionsForStall.mockResolvedValue([
      {
        promotionId: 4,
        name: "Lunch Deal",
        description: "10% off mains",
        discountType: "percentage",
        discountValue: "10.00",
        scopeType: "category",
        scopeCategory: "Mains",
        scopeMenuIds: null,
        isActive: 1,
        startDate: "2026-01-01",
        endDate: "2026-12-31"
      }
    ]);

    const req = mockRequest({ params: { stallId: "3" } });
    const res = mockResponse();

    await StallController.getStallPromotions(req, res, mockNext());

    expect(PromotionModel.getActivePromotionsForStall).toHaveBeenCalledWith(3);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      stallId: 3,
      promotions: [
        {
          promotionId: 4,
          name: "Lunch Deal",
          description: "10% off mains",
          discountType: "percentage",
          discountValue: 10,
          scopeType: "category",
          scopeCategory: "Mains",
          scopeMenuIds: [],
          isActive: true,
          startDate: "2026-01-01",
          endDate: "2026-12-31"
        }
      ]
    });
  });

  it("should respond 400 for a stall id that is not a number", async () => {
    const req = mockRequest({ params: { stallId: "abc" } });
    const res = mockResponse();

    await StallController.getStallPromotions(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "A valid stallId is required" });
    expect(PromotionModel.getActivePromotionsForStall).not.toHaveBeenCalled();
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    PromotionModel.getActivePromotionsForStall.mockRejectedValue(error);

    const req = mockRequest({ params: { stallId: "3" } });
    const res = mockResponse();
    const next = mockNext();

    await StallController.getStallPromotions(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("customerStallController.getAllStalls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return every stall", async () => {
    const stalls = [{ stall_id: 3, stall_name: "Ah Hock Chicken Rice" }];
    StallModel.findAll.mockResolvedValue(stalls);

    const req = mockRequest({ query: {} });
    const res = mockResponse();

    await StallController.getAllStalls(req, res, mockNext());

    expect(StallModel.findAll).toHaveBeenCalledWith({ hawker_id: undefined });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: stalls });
  });

  it("should filter by hawker centre when asked", async () => {
    StallModel.findAll.mockResolvedValue([]);

    const req = mockRequest({ query: { hawker_id: "1" } });
    const res = mockResponse();

    await StallController.getAllStalls(req, res, mockNext());

    expect(StallModel.findAll).toHaveBeenCalledWith({ hawker_id: "1" });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    StallModel.findAll.mockRejectedValue(error);

    const req = mockRequest({ query: {} });
    const res = mockResponse();
    const next = mockNext();

    await StallController.getAllStalls(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("customerStallController.getStallById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the requested stall", async () => {
    const stall = { stall_id: 3, stall_name: "Ah Hock Chicken Rice" };
    StallModel.findById.mockResolvedValue(stall);

    const req = mockRequest({ params: { stallId: "3" }, query: { hawker_id: "1" } });
    const res = mockResponse();

    await StallController.getStallById(req, res, mockNext());

    expect(StallModel.findById).toHaveBeenCalledWith("3", "1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: stall });
  });

  it("should respond 404 when the stall does not exist", async () => {
    StallModel.findById.mockResolvedValue(null);

    const req = mockRequest({ params: { stallId: "999" }, query: {} });
    const res = mockResponse();

    await StallController.getStallById(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Stall not found" });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    StallModel.findById.mockRejectedValue(error);

    const req = mockRequest({ params: { stallId: "3" }, query: {} });
    const res = mockResponse();
    const next = mockNext();

    await StallController.getStallById(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
