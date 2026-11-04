const RentalRenewal = require("../models/rentalRenewalModel");
const { generateRentalAgreementText } = require("../models/rentalAgreementTemplates");
const { createNotification } = require("../models/notificationModel");
const sql = require("mssql");
const { mockTaggedQuery, rows } = require("./helpers/dbMock");

jest.mock("mssql");
jest.mock("../models/rentalAgreementTemplates");
jest.mock("../models/notificationModel");

beforeEach(() => {
  jest.clearAllMocks();
  generateRentalAgreementText.mockReturnValue("Agreement text");
});

describe("rentalRenewalModel.hasPendingRenewal", () => {
  it("should return true when a request is still open", async () => {
    mockTaggedQuery(rows([{ RenewalRequestId: 1 }]));

    await expect(RentalRenewal.hasPendingRenewal(4)).resolves.toBe(true);
  });

  it("should return false when nothing is pending", async () => {
    mockTaggedQuery(rows([]));

    await expect(RentalRenewal.hasPendingRenewal(4)).resolves.toBe(false);
  });
});

describe("rentalRenewalModel.createRenewalRequest", () => {
  it("should insert the request", async () => {
    mockTaggedQuery(rows([]));

    await RentalRenewal.createRenewalRequest(4, 3, 5);

    expect(sql.query).toHaveBeenCalledTimes(1);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database Error"));

    await expect(RentalRenewal.createRenewalRequest(4, 3, 5)).rejects.toThrow("Database Error");
  });
});

describe("rentalRenewalModel.getPendingRenewalRequests", () => {
  it("should return the pending requests with their review details", async () => {
    const requests = [{ RenewalRequestId: 1, stallName: "Ah Hock", vendorName: "vendor1" }];
    mockTaggedQuery(rows(requests));

    await expect(RentalRenewal.getPendingRenewalRequests()).resolves.toEqual(requests);
  });
});

describe("rentalRenewalModel.getRenewalRequestById", () => {
  it("should return the matching request", async () => {
    mockTaggedQuery(rows([{ RenewalRequestId: 1 }]));

    await expect(RentalRenewal.getRenewalRequestById(1)).resolves.toEqual({ RenewalRequestId: 1 });
  });

  it("should return undefined for an unknown id", async () => {
    mockTaggedQuery(rows([]));

    await expect(RentalRenewal.getRenewalRequestById(999)).resolves.toBeUndefined();
  });
});

describe("rentalRenewalModel.approveRenewalRequest", () => {
  function approvalQueryResults() {
    return [
      rows([{ RenewalRequestId: 1, AgreementId: 4, StallId: 3, VendorId: 5, Status: "pending" }]),
      rows([{ AgreementId: 4, AgreementEndDate: "2026-06-30T00:00:00.000Z" }]),
      rows([{ centreName: "Maxwell Food Centre" }]),
      rows([{ username: "operator1" }]),
      rows([{ username: "vendor1" }]),
      rows([{ stallName: "Ah Hock", unitNumber: "01-23" }]),
      rows([{ AgreementId: 12 }]),
      rows([])
    ];
  }

  it("should create the follow-on agreement and notify the vendor", async () => {
    mockTaggedQuery(approvalQueryResults());

    const result = await RentalRenewal.approveRenewalRequest(1, 2, 1800);

    expect(result).toBe("ok");
    expect(generateRentalAgreementText).toHaveBeenCalledWith(
      expect.objectContaining({ ownerName: "operator1", renterName: "vendor1", rentalPrice: 1800 })
    );
    expect(createNotification).toHaveBeenCalledWith(
      5,
      "rental_renewal_approved",
      "Rental renewal approved",
      expect.stringContaining("Ah Hock"),
      "storeRental.html?stallId=3",
      "rentalAgreement",
      12
    );
  });

  it("should start the new agreement the day after the old one ends", async () => {
    mockTaggedQuery(approvalQueryResults());

    await RentalRenewal.approveRenewalRequest(1, 2, 1800);

    const start = generateRentalAgreementText.mock.calls[0][0].startDate;
    const end = generateRentalAgreementText.mock.calls[0][0].endDate;
    expect(start.toISOString().slice(0, 10)).toBe("2026-07-01");
    expect(end.toISOString().slice(0, 10)).toBe("2027-01-01");
  });

  it("should report not found for an unknown request", async () => {
    mockTaggedQuery(rows([]));

    await expect(RentalRenewal.approveRenewalRequest(999, 2, 1800)).resolves.toBe("not found");
  });

  it("should report already reviewed for a decided request", async () => {
    mockTaggedQuery(rows([{ RenewalRequestId: 1, Status: "approved" }]));

    await expect(RentalRenewal.approveRenewalRequest(1, 2, 1800)).resolves.toBe("already reviewed");
  });

  it("should report not found when the current agreement is missing", async () => {
    mockTaggedQuery([
      rows([{ RenewalRequestId: 1, AgreementId: 4, Status: "pending" }]),
      rows([])
    ]);

    await expect(RentalRenewal.approveRenewalRequest(1, 2, 1800)).resolves.toBe("not found");
  });
});

describe("rentalRenewalModel.rejectRenewalRequest", () => {
  it("should mark the request rejected and notify the vendor", async () => {
    mockTaggedQuery([
      rows([{ RenewalRequestId: 1, AgreementId: 4, StallId: 3, VendorId: 5, Status: "pending" }]),
      rows([]),
      rows([{ stallName: "Ah Hock" }])
    ]);

    const result = await RentalRenewal.rejectRenewalRequest(1, 2, "Rate under review");

    expect(result).toBe("ok");
    expect(createNotification).toHaveBeenCalledWith(
      5,
      "rental_renewal_rejected",
      "Rental renewal rejected",
      expect.stringContaining("Rate under review"),
      "storeRental.html?stallId=3",
      "rentalAgreement",
      4
    );
  });

  it("should report not found for an unknown request", async () => {
    mockTaggedQuery(rows([]));

    await expect(RentalRenewal.rejectRenewalRequest(999, 2, null)).resolves.toBe("not found");
  });

  it("should report already reviewed for a decided request", async () => {
    mockTaggedQuery(rows([{ RenewalRequestId: 1, Status: "rejected" }]));

    await expect(RentalRenewal.rejectRenewalRequest(1, 2, null)).resolves.toBe("already reviewed");
  });
});
