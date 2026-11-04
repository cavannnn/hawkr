const satisfactionModel = require("../models/centreSatisfactionModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("centreSatisfactionModel.getStallFeedbackSummary", () => {
  it("should return the centre-wide stall review average", async () => {
    const { request } = mockPool(rows([{ AvgRating: 4.4, FeedbackCount: 20 }]));

    const summary = await satisfactionModel.getStallFeedbackSummary(1);

    expect(request.input).toHaveBeenCalledWith("HawkerId", sql.Int, 1);
    expect(summary).toEqual({ AvgRating: 4.4, FeedbackCount: 20 });
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(satisfactionModel.getStallFeedbackSummary(1)).rejects.toThrow("Database Error");
  });
});

describe("centreSatisfactionModel.getStallFeedbackBreakdown", () => {
  it("should return one row per active stall", async () => {
    const breakdown = [{ StallId: 3, StallName: "Ah Hock", FeedbackCount: 4, AvgRating: 4.5 }];
    mockPool(rows(breakdown));

    await expect(satisfactionModel.getStallFeedbackBreakdown(1)).resolves.toEqual(breakdown);
  });
});

describe("centreSatisfactionModel.getHawkerFeedbackSummary", () => {
  it("should return the centre feedback average", async () => {
    mockPool(rows([{ AvgRating: 3.2, FeedbackCount: 5 }]));

    await expect(satisfactionModel.getHawkerFeedbackSummary(1)).resolves.toEqual({
      AvgRating: 3.2,
      FeedbackCount: 5
    });
  });
});

describe("centreSatisfactionModel.getHawkerFeedbackFacilityBreakdown", () => {
  it("should return one row per facility tag", async () => {
    const breakdown = [{ FacilityTag: "Seating", FeedbackCount: 3, AvgRating: 3 }];
    mockPool(rows(breakdown));

    await expect(satisfactionModel.getHawkerFeedbackFacilityBreakdown(1)).resolves.toEqual(breakdown);
  });
});

describe("centreSatisfactionModel.getHawkerFeedbackTrend", () => {
  it("should return the recent and previous averages", async () => {
    mockPool(rows([{ RecentAvg: 3.8, PreviousAvg: 3.2 }]));

    await expect(satisfactionModel.getHawkerFeedbackTrend(1)).resolves.toEqual({
      RecentAvg: 3.8,
      PreviousAvg: 3.2
    });
  });
});

describe("centreSatisfactionModel.getNegativeStallFeedback", () => {
  it("should filter stall reviews at or below the ceiling", async () => {
    const negative = [{ reviewId: 1, Rating: 2 }];
    const { request } = mockPool(rows(negative));

    const result = await satisfactionModel.getNegativeStallFeedback(1, 2);

    expect(request.input).toHaveBeenCalledWith("MaxRating", sql.Int, 2);
    expect(result).toEqual(negative);
  });
});

describe("centreSatisfactionModel.getNegativeHawkerFeedback", () => {
  it("should filter centre feedback at or below the ceiling", async () => {
    const negative = [{ FeedbackId: 31, Rating: 1 }];
    const { request } = mockPool(rows(negative));

    const result = await satisfactionModel.getNegativeHawkerFeedback(1, 2);

    expect(request.input).toHaveBeenCalledWith("MaxRating", sql.Int, 2);
    expect(result).toEqual(negative);
  });

  it("should return an empty list when there is no negative feedback", async () => {
    mockPool(rows([]));

    await expect(satisfactionModel.getNegativeHawkerFeedback(1, 2)).resolves.toEqual([]);
  });
});
