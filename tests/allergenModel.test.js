const AllergenModel = require("../models/allergenModel");
const sql = require("mssql");
const { mockPool, mockTransaction, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

describe("AllergenModel.getUserAllergens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the customer's stored allergen rows", async () => {
    const stored = [
      { allergenName: "seafood", createdAt: "2026-01-01" },
      { allergenName: "durian", createdAt: "2026-01-02" }
    ];
    const { request } = mockPool(rows(stored));

    const result = await AllergenModel.getUserAllergens(7);

    expect(request.input).toHaveBeenCalledWith("userId", sql.Int, 7);
    expect(result).toEqual(stored);
  });

  it("should return an empty list when nothing is saved", async () => {
    mockPool(rows([]));

    await expect(AllergenModel.getUserAllergens(7)).resolves.toEqual([]);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(AllergenModel.getUserAllergens(7)).rejects.toThrow("Database Error");
  });
});

describe("AllergenModel.replaceUserAllergens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete the old set, insert each name and commit", async () => {
    mockPool(rows([]));
    const { transaction, request } = mockTransaction(rows([]));

    const saved = await AllergenModel.replaceUserAllergens(7, ["seafood", "nuts"]);

    expect(transaction.begin).toHaveBeenCalledTimes(1);
    expect(request.query).toHaveBeenCalledTimes(3);
    expect(request.input).toHaveBeenCalledWith("allergenName", undefined, "seafood");
    expect(request.input).toHaveBeenCalledWith("allergenName", undefined, "nuts");
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();
    expect(saved).toBe(2);
  });

  it("should only clear the set when the list is empty", async () => {
    mockPool(rows([]));
    const { transaction, request } = mockTransaction(rows([]));

    const saved = await AllergenModel.replaceUserAllergens(7, []);

    expect(request.query).toHaveBeenCalledTimes(1);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(saved).toBe(0);
  });

  it("should roll back and rethrow when an insert fails", async () => {
    mockPool(rows([]));
    const { transaction } = mockTransaction([rows([]), new Error("Insert failed")]);

    await expect(AllergenModel.replaceUserAllergens(7, ["seafood"])).rejects.toThrow("Insert failed");
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.commit).not.toHaveBeenCalled();
  });
});
