const rentalAgreementModel = require("../models/rentalAgreementModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

describe("rentalAgreementModel.getAllRentalAgreements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return every agreement", async () => {
    const agreements = [{ AgreementId: 1 }, { AgreementId: 2 }];
    mockPool(rows(agreements));

    await expect(rentalAgreementModel.getAllRentalAgreements()).resolves.toEqual(agreements);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(rentalAgreementModel.getAllRentalAgreements()).rejects.toThrow("Database Error");
  });
});

describe("rentalAgreementModel.getRentalAgreementById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the matching agreement", async () => {
    const { request } = mockPool(rows([{ AgreementId: 1, StallId: 3 }]));

    const agreement = await rentalAgreementModel.getRentalAgreementById(1);

    expect(request.input).toHaveBeenCalledWith("id", sql.Int, 1);
    expect(agreement).toEqual({ AgreementId: 1, StallId: 3 });
  });

  it("should return undefined for an unknown id", async () => {
    mockPool(rows([]));

    await expect(rentalAgreementModel.getRentalAgreementById(999)).resolves.toBeUndefined();
  });
});

describe("rentalAgreementModel.getAgreementsByStall", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return every agreement for one stall", async () => {
    const agreements = [{ AgreementId: 2 }, { AgreementId: 1 }];
    const { request } = mockPool(rows(agreements));

    const result = await rentalAgreementModel.getAgreementsByStall(3);

    expect(request.input).toHaveBeenCalledWith("StallId", sql.Int, 3);
    expect(result).toEqual(agreements);
  });

  it("should return an empty list for a stall with no agreements", async () => {
    mockPool(rows([]));

    await expect(rentalAgreementModel.getAgreementsByStall(3)).resolves.toEqual([]);
  });
});

describe("rentalAgreementModel.createRentalAgreement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should stamp the operator's username and return the new id", async () => {
    const { request } = mockPool([rows([{ username: "operator1" }]), rows([{ AgreementId: 12 }])]);

    const newId = await rentalAgreementModel.createRentalAgreement({
      StallId: 3,
      OwnerId: 2,
      AgreementStartDate: "2026-01-01",
      AgreementEndDate: "2026-07-01",
      AgreementTermsAndConditions: "Terms",
      RentalPrice: 1500
    });

    expect(request.input).toHaveBeenCalledWith("ContractName", undefined, "operator1");
    expect(newId).toBe(12);
  });

  it("should fall back to a null contract name for an unknown operator", async () => {
    const { request } = mockPool([rows([]), rows([{ AgreementId: 13 }])]);

    await rentalAgreementModel.createRentalAgreement({ StallId: 3, OwnerId: 99, RentalPrice: 1500 });

    expect(request.input).toHaveBeenCalledWith("ContractName", undefined, null);
  });
});

describe("rentalAgreementModel.updateRentalAgreement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should refresh the contract name while updating", async () => {
    const { request } = mockPool([rows([{ username: "operator1" }]), rows([])]);

    await rentalAgreementModel.updateRentalAgreement(1, {
      StallId: 3,
      OwnerId: 2,
      AgreementEndDate: "2027-01-01",
      AgreementTermsAndConditions: "Terms",
      RentalPrice: 1800
    });

    expect(request.input).toHaveBeenCalledWith("AgreementId", sql.SmallInt, 1);
    expect(request.input).toHaveBeenCalledWith("ContractName", undefined, "operator1");
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(rentalAgreementModel.updateRentalAgreement(1, {})).rejects.toThrow("Database Error");
  });
});

describe("rentalAgreementModel.deleteRentalAgreement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete by agreement id", async () => {
    const { request } = mockPool(rows([]));

    await rentalAgreementModel.deleteRentalAgreement(1);

    expect(request.input).toHaveBeenCalledWith("AgreementId", sql.SmallInt, 1);
    expect(request.query).toHaveBeenCalledTimes(1);
  });

  it("should propagate a database error", async () => {
    mockPool(new Error("Database Error"));

    await expect(rentalAgreementModel.deleteRentalAgreement(1)).rejects.toThrow("Database Error");
  });
});
