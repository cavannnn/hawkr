const CuisineModel = require("../models/cuisineModel");
const sql = require("mssql");
const { MAX_CUISINES } = require("../config/cuisines");
const { mockPool, mockTransaction, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

describe("CuisineModel.getUserCuisines", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the customer's palette rows in the order chosen", async () => {
    const palette = [
      { cuisineName: "Malay", createdAt: "2026-01-01" },
      { cuisineName: "Japanese", createdAt: "2026-01-02" }
    ];
    const { request } = mockPool(rows(palette));

    const result = await CuisineModel.getUserCuisines(7);

    expect(request.input).toHaveBeenCalledWith("userId", sql.Int, 7);
    expect(result).toEqual(palette);
  });

  it("should return an empty list when nothing is saved", async () => {
    mockPool(rows([]));

    await expect(CuisineModel.getUserCuisines(7)).resolves.toEqual([]);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(CuisineModel.getUserCuisines(7)).rejects.toThrow("Database Error");
  });
});

describe("CuisineModel.replaceUserCuisines", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should clear the palette then insert each cuisine", async () => {
    mockPool(rows([]));
    const { transaction, request } = mockTransaction(rows([]));

    const saved = await CuisineModel.replaceUserCuisines(7, ["Thai", "Korean"]);

    expect(request.query).toHaveBeenCalledTimes(3);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(saved).toBe(2);
  });

  it("should only clear the palette when the list is empty", async () => {
    mockPool(rows([]));
    const { transaction, request } = mockTransaction(rows([]));

    const saved = await CuisineModel.replaceUserCuisines(7, []);

    expect(request.query).toHaveBeenCalledTimes(1);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(saved).toBe(0);
  });

  it("should refuse more cuisines than the configured maximum", async () => {
    const tooMany = Array.from({ length: MAX_CUISINES + 1 }, (value, index) => "Cuisine" + index);

    await expect(CuisineModel.replaceUserCuisines(7, tooMany)).rejects.toThrow(
      "replaceUserCuisines called with " + tooMany.length + " cuisines; the maximum is " + MAX_CUISINES
    );
    expect(sql.connect).not.toHaveBeenCalled();
  });

  it("should roll back and rethrow when an insert fails", async () => {
    mockPool(rows([]));
    const { transaction } = mockTransaction([rows([]), new Error("Insert failed")]);

    await expect(CuisineModel.replaceUserCuisines(7, ["Thai"])).rejects.toThrow("Insert failed");
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.commit).not.toHaveBeenCalled();
  });
});
