const centreManagementController = require("../controllers/centreManagementController");
const closureModel = require("../models/centreClosureModel");
const analyticsModel = require("../models/centreAnalyticsModel");
const satisfactionModel = require("../models/centreSatisfactionModel");
const promotionModel = require("../models/centrePromotionModel");
const { mockPool, rows } = require("./helpers/dbMock");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("mssql");
jest.mock("../models/centreClosureModel");
jest.mock("../models/centreAnalyticsModel");
jest.mock("../models/centreSatisfactionModel");
jest.mock("../models/centrePromotionModel");

function allowAssignment() {
  mockPool(rows([{ ok: 1 }]));
}

function denyAssignment() {
  mockPool(rows([]));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("centreManagementController.getCentreStatus", () => {
  it("should return closures and promotions with their targeted stalls", async () => {
    closureModel.getClosuresForHawker.mockResolvedValue([{ ClosureId: 1 }]);
    promotionModel.getPromotionsForHawker.mockResolvedValue([{ PromotionId: 4, Name: "Centre Deal" }]);
    promotionModel.getPromotionStallMap.mockResolvedValue(new Map([[4, [3, 6]]]));

    const req = mockRequest({ params: { hawkerId: "1" } });
    const res = mockResponse();

    await centreManagementController.getCentreStatus(req, res);

    expect(res.json).toHaveBeenCalledWith({
      HawkerId: 1,
      closures: [{ ClosureId: 1 }],
      promotions: [{ PromotionId: 4, Name: "Centre Deal", StallIds: [3, 6] }]
    });
  });

  it("should default to an empty stall list for an untargeted promotion", async () => {
    closureModel.getClosuresForHawker.mockResolvedValue([]);
    promotionModel.getPromotionsForHawker.mockResolvedValue([{ PromotionId: 4 }]);
    promotionModel.getPromotionStallMap.mockResolvedValue(new Map());

    const req = mockRequest({ params: { hawkerId: "1" } });
    const res = mockResponse();

    await centreManagementController.getCentreStatus(req, res);

    expect(res.json.mock.calls[0][0].promotions[0].StallIds).toEqual([]);
  });

  it("should respond 400 without a hawker id", async () => {
    const req = mockRequest({ params: { hawkerId: "abc" } });
    const res = mockResponse();

    await centreManagementController.getCentreStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "hawkerId is required" });
  });

  it("should respond 500 when the lookup fails", async () => {
    closureModel.getClosuresForHawker.mockRejectedValue(new Error("Database error"));
    promotionModel.getPromotionsForHawker.mockResolvedValue([]);
    promotionModel.getPromotionStallMap.mockResolvedValue(new Map());

    const req = mockRequest({ params: { hawkerId: "1" } });
    const res = mockResponse();

    await centreManagementController.getCentreStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch centre status" });
  });
});

describe("centreManagementController.getStallCentreStatus", () => {
  it("should return the stall's centre with its closures and promotions", async () => {
    mockPool(rows([{ StallId: 3, StallName: "Ah Hock", HawkerId: 1, CentreName: "Maxwell" }]));
    closureModel.getClosuresForHawker.mockResolvedValue([{ ClosureId: 1 }]);
    promotionModel.getPromotionsForStall.mockResolvedValue([{ PromotionId: 4 }]);

    const req = mockRequest({ params: { stallId: "3" } });
    const res = mockResponse();

    await centreManagementController.getStallCentreStatus(req, res);

    expect(res.json).toHaveBeenCalledWith({
      StallId: 3,
      StallName: "Ah Hock",
      HawkerId: 1,
      CentreName: "Maxwell",
      closures: [{ ClosureId: 1 }],
      promotions: [{ PromotionId: 4 }]
    });
  });

  it("should respond 400 without a stall id", async () => {
    const req = mockRequest({ params: { stallId: "abc" } });
    const res = mockResponse();

    await centreManagementController.getStallCentreStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "stallId is required" });
  });

  it("should respond 404 when the stall does not exist", async () => {
    mockPool(rows([]));

    const req = mockRequest({ params: { stallId: "999" } });
    const res = mockResponse();

    await centreManagementController.getStallCentreStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Stall not found" });
  });
});

describe("centreManagementController.getClosures", () => {
  it("should return the closures of an assigned centre", async () => {
    allowAssignment();
    closureModel.getClosuresForHawker.mockResolvedValue([{ ClosureId: 1 }]);

    const req = mockRequest({ query: { hawkerId: "1" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getClosures(req, res);

    expect(res.json).toHaveBeenCalledWith([{ ClosureId: 1 }]);
  });

  it("should respond 400 without a hawker id", async () => {
    const req = mockRequest({ query: {}, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getClosures(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should respond 403 for a centre the operator is not assigned to", async () => {
    denyAssignment();

    const req = mockRequest({ query: { hawkerId: "1" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getClosures(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "You are not assigned to this hawker centre" });
    expect(closureModel.getClosuresForHawker).not.toHaveBeenCalled();
  });
});

describe("centreManagementController.createClosure", () => {
  it("should schedule a closure that does not overlap", async () => {
    allowAssignment();
    closureModel.hasOverlap.mockResolvedValue(false);
    closureModel.createClosure.mockResolvedValue(11);

    const req = mockRequest({
      user: { id: 2 },
      body: { HawkerId: 1, Reason: "Maintenance", StartDateTime: "2026-03-01", EndDateTime: "2026-03-02" }
    });
    const res = mockResponse();

    await centreManagementController.createClosure(req, res);

    expect(closureModel.createClosure).toHaveBeenCalledWith(
      expect.objectContaining({ HawkerId: 1, CreatedByOperatorId: 2 })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "Closure scheduled", ClosureId: 11 });
  });

  it("should respond 409 when it overlaps an existing closure", async () => {
    allowAssignment();
    closureModel.hasOverlap.mockResolvedValue(true);

    const req = mockRequest({
      user: { id: 2 },
      body: { HawkerId: 1, StartDateTime: "2026-03-01", EndDateTime: "2026-03-02" }
    });
    const res = mockResponse();

    await centreManagementController.createClosure(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(closureModel.createClosure).not.toHaveBeenCalled();
  });

  it("should respond 403 for an unassigned centre", async () => {
    denyAssignment();

    const req = mockRequest({ user: { id: 2 }, body: { HawkerId: 1 } });
    const res = mockResponse();

    await centreManagementController.createClosure(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("centreManagementController.endClosure", () => {
  it("should end an active closure early", async () => {
    closureModel.getClosureById.mockResolvedValue({ ClosureId: 11, HawkerId: 1 });
    allowAssignment();
    closureModel.endClosureEarly.mockResolvedValue(true);

    const req = mockRequest({ params: { id: "11" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.endClosure(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Closure ended" });
  });

  it("should respond 404 when the closure does not exist", async () => {
    closureModel.getClosureById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.endClosure(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should respond 409 when the closure is not active", async () => {
    closureModel.getClosureById.mockResolvedValue({ ClosureId: 11, HawkerId: 1 });
    allowAssignment();
    closureModel.endClosureEarly.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "11" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.endClosure(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("centreManagementController.cancelClosure", () => {
  it("should cancel a scheduled closure", async () => {
    closureModel.getClosureById.mockResolvedValue({ ClosureId: 11, HawkerId: 1 });
    allowAssignment();
    closureModel.cancelClosure.mockResolvedValue(true);

    const req = mockRequest({ params: { id: "11" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.cancelClosure(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Closure cancelled" });
  });

  it("should respond 409 when the closure is already running", async () => {
    closureModel.getClosureById.mockResolvedValue({ ClosureId: 11, HawkerId: 1 });
    allowAssignment();
    closureModel.cancelClosure.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "11" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.cancelClosure(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("centreManagementController.getAnalytics", () => {
  it("should summarise the peak hour and under-utilised stalls", async () => {
    allowAssignment();
    analyticsModel.getOrderVolumeByHour.mockResolvedValue([
      { HourOfDay: 11, OrderCount: 4 },
      { HourOfDay: 12, OrderCount: 9 }
    ]);
    analyticsModel.getOrderVolumeByDay.mockResolvedValue([{ OrderDay: "2026-02-01", OrderCount: 13 }]);
    analyticsModel.getStallUtilisation.mockResolvedValue([
      { StallId: 3, OrderCount: 2 },
      { StallId: 6, OrderCount: 11 }
    ]);
    analyticsModel.getCentreOrderTotal.mockResolvedValue(13);

    const req = mockRequest({ params: { hawkerId: "1" }, query: {}, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getAnalytics(req, res);

    const sent = res.json.mock.calls[0][0];
    expect(sent.period).toBe("week");
    expect(sent.totalOrders).toBe(13);
    expect(sent.peakHour).toBe(12);
    expect(sent.underUtilisedStalls).toEqual([{ StallId: 3, OrderCount: 2 }]);
  });

  it("should accept the month period", async () => {
    allowAssignment();
    analyticsModel.getOrderVolumeByHour.mockResolvedValue([]);
    analyticsModel.getOrderVolumeByDay.mockResolvedValue([]);
    analyticsModel.getStallUtilisation.mockResolvedValue([]);
    analyticsModel.getCentreOrderTotal.mockResolvedValue(0);

    const req = mockRequest({ params: { hawkerId: "1" }, query: { period: "month" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getAnalytics(req, res);

    expect(analyticsModel.getOrderVolumeByHour).toHaveBeenCalledWith(1, "month");
    expect(res.json.mock.calls[0][0].peakHour).toBeNull();
  });

  it("should respond 403 for an unassigned centre", async () => {
    denyAssignment();

    const req = mockRequest({ params: { hawkerId: "1" }, query: {}, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getAnalytics(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("centreManagementController.getSatisfaction", () => {
  it("should band each average and report the trend direction", async () => {
    allowAssignment();
    satisfactionModel.getStallFeedbackSummary.mockResolvedValue({ AvgRating: 4.4, FeedbackCount: 20 });
    satisfactionModel.getStallFeedbackBreakdown.mockResolvedValue([]);
    satisfactionModel.getHawkerFeedbackSummary.mockResolvedValue({ AvgRating: 2.1, FeedbackCount: 5 });
    satisfactionModel.getHawkerFeedbackFacilityBreakdown.mockResolvedValue([]);
    satisfactionModel.getHawkerFeedbackTrend.mockResolvedValue({ RecentAvg: 3, PreviousAvg: 4 });

    const req = mockRequest({ params: { hawkerId: "1" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getSatisfaction(req, res);

    const sent = res.json.mock.calls[0][0];
    expect(sent.stallFeedback.band).toBe("green");
    expect(sent.hawkerFeedback.band).toBe("red");
    expect(sent.trend.direction).toBe("down");
  });

  it("should report a flat trend when there is nothing to compare", async () => {
    allowAssignment();
    satisfactionModel.getStallFeedbackSummary.mockResolvedValue({ AvgRating: null });
    satisfactionModel.getStallFeedbackBreakdown.mockResolvedValue([]);
    satisfactionModel.getHawkerFeedbackSummary.mockResolvedValue({ AvgRating: 3.5 });
    satisfactionModel.getHawkerFeedbackFacilityBreakdown.mockResolvedValue([]);
    satisfactionModel.getHawkerFeedbackTrend.mockResolvedValue({ RecentAvg: null, PreviousAvg: null });

    const req = mockRequest({ params: { hawkerId: "1" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getSatisfaction(req, res);

    const sent = res.json.mock.calls[0][0];
    expect(sent.stallFeedback.band).toBe("none");
    expect(sent.hawkerFeedback.band).toBe("yellow");
    expect(sent.trend.direction).toBe("flat");
  });

  it("should respond 500 when a lookup fails", async () => {
    allowAssignment();
    satisfactionModel.getStallFeedbackSummary.mockRejectedValue(new Error("Database error"));
    satisfactionModel.getStallFeedbackBreakdown.mockResolvedValue([]);
    satisfactionModel.getHawkerFeedbackSummary.mockResolvedValue({});
    satisfactionModel.getHawkerFeedbackFacilityBreakdown.mockResolvedValue([]);
    satisfactionModel.getHawkerFeedbackTrend.mockResolvedValue({});

    const req = mockRequest({ params: { hawkerId: "1" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getSatisfaction(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("centreManagementController.getNegativeFeedback", () => {
  it("should default to the stall review drill-down", async () => {
    allowAssignment();
    satisfactionModel.getNegativeStallFeedback.mockResolvedValue([{ reviewId: 1 }]);

    const req = mockRequest({ params: { hawkerId: "1" }, query: {}, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getNegativeFeedback(req, res);

    expect(satisfactionModel.getNegativeStallFeedback).toHaveBeenCalledWith(1, 2);
    expect(res.json).toHaveBeenCalledWith([{ reviewId: 1 }]);
  });

  it("should use the hawker feedback source when asked", async () => {
    allowAssignment();
    satisfactionModel.getNegativeHawkerFeedback.mockResolvedValue([]);

    const req = mockRequest({ params: { hawkerId: "1" }, query: { source: "hawker" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getNegativeFeedback(req, res);

    expect(satisfactionModel.getNegativeHawkerFeedback).toHaveBeenCalledWith(1, 2);
  });
});

describe("centreManagementController.getStalls", () => {
  it("should list the active stalls of an assigned centre", async () => {
    allowAssignment();
    promotionModel.getActiveStallsForHawker.mockResolvedValue([{ StallId: 3 }]);

    const req = mockRequest({ query: { hawkerId: "1" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getStalls(req, res);

    expect(res.json).toHaveBeenCalledWith([{ StallId: 3 }]);
  });

  it("should respond 400 without a hawker id", async () => {
    const req = mockRequest({ query: {}, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getStalls(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("centreManagementController.getPromotions", () => {
  it("should list the centre's promotions", async () => {
    allowAssignment();
    promotionModel.getPromotionsForHawker.mockResolvedValue([{ PromotionId: 4 }]);

    const req = mockRequest({ query: { hawkerId: "1" }, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getPromotions(req, res);

    expect(res.json).toHaveBeenCalledWith([{ PromotionId: 4 }]);
  });

  it("should respond 400 without a hawker id", async () => {
    const req = mockRequest({ query: {}, user: { id: 2 } });
    const res = mockResponse();

    await centreManagementController.getPromotions(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("centreManagementController.createPromotion", () => {
  it("should create a promotion for stalls in the same centre", async () => {
    allowAssignment();
    promotionModel.stallsBelongToHawker.mockResolvedValue(true);
    promotionModel.createPromotion.mockResolvedValue(4);

    const req = mockRequest({
      user: { id: 2 },
      body: { HawkerId: 1, Name: "Centre Deal", stallIds: [3, 6] }
    });
    const res = mockResponse();

    await centreManagementController.createPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "Promotion created", PromotionId: 4 });
  });

  it("should respond 400 when a stall belongs to a different centre", async () => {
    allowAssignment();
    promotionModel.stallsBelongToHawker.mockResolvedValue(false);

    const req = mockRequest({ user: { id: 2 }, body: { HawkerId: 1, stallIds: [99] } });
    const res = mockResponse();

    await centreManagementController.createPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(promotionModel.createPromotion).not.toHaveBeenCalled();
  });

  it("should respond 403 for an unassigned centre", async () => {
    denyAssignment();

    const req = mockRequest({ user: { id: 2 }, body: { HawkerId: 1 } });
    const res = mockResponse();

    await centreManagementController.createPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("centreManagementController.clonePromotion", () => {
  it("should clone a promotion into another assigned centre", async () => {
    promotionModel.getPromotionById.mockResolvedValue({ PromotionId: 4, HawkerId: 1 });
    mockPool([rows([{ ok: 1 }]), rows([{ ok: 1 }])]);
    promotionModel.clonePromotion.mockResolvedValue(5);

    const req = mockRequest({ params: { id: "4" }, user: { id: 2 }, body: { targetHawkerId: 2 } });
    const res = mockResponse();

    await centreManagementController.clonePromotion(req, res);

    expect(promotionModel.clonePromotion).toHaveBeenCalledWith({ PromotionId: 4, HawkerId: 1 }, 2, 2);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should respond 404 when the source promotion does not exist", async () => {
    promotionModel.getPromotionById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" }, user: { id: 2 }, body: { targetHawkerId: 2 } });
    const res = mockResponse();

    await centreManagementController.clonePromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should respond 403 when the target centre is not assigned to the operator", async () => {
    promotionModel.getPromotionById.mockResolvedValue({ PromotionId: 4, HawkerId: 1 });
    mockPool([rows([{ ok: 1 }]), rows([])]);

    const req = mockRequest({ params: { id: "4" }, user: { id: 2 }, body: { targetHawkerId: 9 } });
    const res = mockResponse();

    await centreManagementController.clonePromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(promotionModel.clonePromotion).not.toHaveBeenCalled();
  });
});
