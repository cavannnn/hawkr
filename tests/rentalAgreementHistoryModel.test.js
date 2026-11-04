const historyModel = require("../models/rentalAgreementHistoryModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

describe("rentalAgreementHistoryModel.getAllHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return every archived agreement", async () => {
    const history = [{ HistoryId: 2 }, { HistoryId: 1 }];
    mockPool(rows(history));

    await expect(historyModel.getAllHistory()).resolves.toEqual(history);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(historyModel.getAllHistory()).rejects.toThrow("Database Error");
  });
});

describe("rentalAgreementHistoryModel.getHistoryById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the matching history entry", async () => {
    const { request } = mockPool(rows([{ HistoryId: 1, Status: "Expired" }]));

    const entry = await historyModel.getHistoryById(1);

    expect(request.input).toHaveBeenCalledWith("id", sql.Int, 1);
    expect(entry).toEqual({ HistoryId: 1, Status: "Expired" });
  });

  it("should return undefined for an unknown id", async () => {
    mockPool(rows([]));

    await expect(historyModel.getHistoryById(999)).resolves.toBeUndefined();
  });
});

describe("rentalAgreementHistoryModel.createHistoryEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should archive the agreement under the given status", async () => {
    const { request } = mockPool(rows([]));

    await historyModel.createHistoryEntry(
      {
        AgreementId: 1,
        AgreementStartDate: "2026-01-01",
        AgreementEndDate: "2026-07-01",
        AgreementTermsAndConditions: "Terms",
        RentalPrice: 1500,
        OwnerId: 2,
        StallId: 3
      },
      "Expired"
    );

    expect(request.input).toHaveBeenCalledWith("AgreementId", sql.SmallInt, 1);
    expect(request.input).toHaveBeenCalledWith("StallId", sql.Int, 3);
    expect(request.input).toHaveBeenCalledWith("Status", undefined, "Expired");
    expect(request.query).toHaveBeenCalledTimes(1);
  });

  it("should propagate a database error", async () => {
    mockPool(new Error("Database Error"));

    await expect(historyModel.createHistoryEntry({ AgreementId: 1 }, "Cancelled")).rejects.toThrow(
      "Database Error"
    );
  });
});
