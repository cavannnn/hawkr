const HawkerModel = require("../models/neaHawkerModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

describe("neaHawkerModel.getAllHawkerCentres", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return every hawker centre row", async () => {
    const centres = [
      { centreId: 1, centreName: "Maxwell Food Centre" },
      { centreId: 2, centreName: "Old Airport Road Food Centre" }
    ];
    const { pool } = mockPool(rows(centres));

    const result = await HawkerModel.getAllHawkerCentres();

    expect(sql.connect).toHaveBeenCalledWith(expect.any(Object));
    expect(pool.request).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(2);
    expect(result[0].centreName).toBe("Maxwell Food Centre");
  });

  it("should return an empty list when there are no centres", async () => {
    mockPool(rows([]));

    await expect(HawkerModel.getAllHawkerCentres()).resolves.toEqual([]);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(HawkerModel.getAllHawkerCentres()).rejects.toThrow("Database Error");
  });
});

describe("neaHawkerModel.getStallsByCentre", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should query the stalls of one centre", async () => {
    const stalls = [{ stallId: 10, stallName: "Tian Tian Chicken Rice", centreId: 1 }];
    const { request } = mockPool(rows(stalls));

    const result = await HawkerModel.getStallsByCentre(1);

    expect(request.input).toHaveBeenCalledWith("cid", sql.Int, 1);
    expect(result).toEqual(stalls);
  });

  it("should return an empty list for a centre with no stalls", async () => {
    mockPool(rows([]));

    await expect(HawkerModel.getStallsByCentre(99)).resolves.toEqual([]);
  });

  it("should propagate a query error", async () => {
    mockPool(new Error("Database Error"));

    await expect(HawkerModel.getStallsByCentre(1)).rejects.toThrow("Database Error");
  });
});
