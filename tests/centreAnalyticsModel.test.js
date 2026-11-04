const analyticsModel = require("../models/centreAnalyticsModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

function sinceArgument(request) {
  const call = request.input.mock.calls.find(args => args[0] === "Since");
  return call[2];
}

function daysAgo(since) {
  const now = new Date();
  return Math.round((now - since) / (24 * 60 * 60 * 1000));
}

describe("centreAnalyticsModel.getOrderVolumeByHour", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the hourly order counts", async () => {
    const volumes = [{ HourOfDay: 12, OrderCount: 9 }];
    const { request } = mockPool(rows(volumes));

    const result = await analyticsModel.getOrderVolumeByHour(1, "week");

    expect(request.input).toHaveBeenCalledWith("HawkerId", sql.Int, 1);
    expect(result).toEqual(volumes);
  });

  it("should look back 7 days for the week period", async () => {
    const { request } = mockPool(rows([]));

    await analyticsModel.getOrderVolumeByHour(1, "week");

    expect(daysAgo(sinceArgument(request))).toBe(7);
  });

  it("should look back 30 days for the month period", async () => {
    const { request } = mockPool(rows([]));

    await analyticsModel.getOrderVolumeByHour(1, "month");

    expect(daysAgo(sinceArgument(request))).toBe(30);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(analyticsModel.getOrderVolumeByHour(1, "week")).rejects.toThrow("Database Error");
  });
});

describe("centreAnalyticsModel.getOrderVolumeByDay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the daily order counts", async () => {
    const volumes = [{ OrderDay: "2026-02-01", OrderCount: 13 }];
    mockPool(rows(volumes));

    await expect(analyticsModel.getOrderVolumeByDay(1, "week")).resolves.toEqual(volumes);
  });

  it("should return an empty list when there are no orders", async () => {
    mockPool(rows([]));

    await expect(analyticsModel.getOrderVolumeByDay(1, "week")).resolves.toEqual([]);
  });
});

describe("centreAnalyticsModel.getStallUtilisation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return each active stall's order count", async () => {
    const utilisation = [{ StallId: 3, StallName: "Ah Hock", OrderCount: 2 }];
    mockPool(rows(utilisation));

    await expect(analyticsModel.getStallUtilisation(1, "month")).resolves.toEqual(utilisation);
  });
});

describe("centreAnalyticsModel.getCentreOrderTotal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the centre-wide order count", async () => {
    mockPool(rows([{ OrderCount: 13 }]));

    await expect(analyticsModel.getCentreOrderTotal(1, "week")).resolves.toBe(13);
  });

  it("should propagate a database error", async () => {
    mockPool(new Error("Database Error"));

    await expect(analyticsModel.getCentreOrderTotal(1, "week")).rejects.toThrow("Database Error");
  });
});
