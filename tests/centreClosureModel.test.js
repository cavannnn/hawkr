const closureModel = require("../models/centreClosureModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");

describe("centreClosureModel.getClosuresForHawker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should reconcile statuses before listing the closures", async () => {
    const closures = [{ ClosureId: 1, Status: "Active" }];
    const { request } = mockPool([rows([]), rows([]), rows(closures)]);

    const result = await closureModel.getClosuresForHawker(1);

    expect(request.query).toHaveBeenCalledTimes(3);
    expect(result).toEqual(closures);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(closureModel.getClosuresForHawker(1)).rejects.toThrow("Database Error");
  });
});

describe("centreClosureModel.isCentreCurrentlyClosed", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when an active closure exists", async () => {
    mockPool([rows([]), rows([]), rows([{ ok: 1 }])]);

    await expect(closureModel.isCentreCurrentlyClosed(1)).resolves.toBe(true);
  });

  it("should return false when nothing is active", async () => {
    mockPool([rows([]), rows([]), rows([])]);

    await expect(closureModel.isCentreCurrentlyClosed(1)).resolves.toBe(false);
  });
});

describe("centreClosureModel.hasOverlap", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when the window collides with another closure", async () => {
    mockPool(rows([{ ok: 1 }]));

    await expect(closureModel.hasOverlap(1, "2026-03-01", "2026-03-02")).resolves.toBe(true);
  });

  it("should return false when the window is clear", async () => {
    mockPool(rows([]));

    await expect(closureModel.hasOverlap(1, "2026-03-01", "2026-03-02")).resolves.toBe(false);
  });

  it("should exclude a given closure from the comparison", async () => {
    const { request } = mockPool(rows([]));

    await closureModel.hasOverlap(1, "2026-03-01", "2026-03-02", 11);

    expect(request.input).toHaveBeenCalledWith("ExcludeId", sql.Int, 11);
    expect(request.query.mock.calls[0][0]).toContain("ClosureId <> @ExcludeId");
  });
});

describe("centreClosureModel.createClosure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should insert the closure and return its new id", async () => {
    const { request } = mockPool(rows([{ ClosureId: 11 }]));

    const closureId = await closureModel.createClosure({
      HawkerId: 1,
      Reason: "Maintenance",
      StartDateTime: "2026-03-01",
      EndDateTime: "2026-03-02",
      CreatedByOperatorId: 2,
      Notes: "Deep clean"
    });

    expect(request.input).toHaveBeenCalledWith("HawkerId", sql.Int, 1);
    expect(closureId).toBe(11);
  });

  it("should store null notes when none were given", async () => {
    const { request } = mockPool(rows([{ ClosureId: 12 }]));

    await closureModel.createClosure({ HawkerId: 1, CreatedByOperatorId: 2 });

    expect(request.input).toHaveBeenCalledWith("Notes", undefined, null);
  });
});

describe("centreClosureModel.getClosureById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the matching closure", async () => {
    mockPool(rows([{ ClosureId: 11, HawkerId: 1 }]));

    await expect(closureModel.getClosureById(11)).resolves.toEqual({ ClosureId: 11, HawkerId: 1 });
  });

  it("should return undefined for an unknown id", async () => {
    mockPool(rows([]));

    await expect(closureModel.getClosureById(999)).resolves.toBeUndefined();
  });
});

describe("centreClosureModel.endClosureEarly", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when an active closure was ended", async () => {
    mockPool(affected(1));

    await expect(closureModel.endClosureEarly(11)).resolves.toBe(true);
  });

  it("should return false when the closure was not active", async () => {
    mockPool(affected(0));

    await expect(closureModel.endClosureEarly(11)).resolves.toBe(false);
  });
});

describe("centreClosureModel.cancelClosure", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when a scheduled closure was cancelled", async () => {
    mockPool(affected(1));

    await expect(closureModel.cancelClosure(11)).resolves.toBe(true);
  });

  it("should return false when the closure was not scheduled", async () => {
    mockPool(affected(0));

    await expect(closureModel.cancelClosure(11)).resolves.toBe(false);
  });
});
