const Stall = require("../models/stallModel");
const { generateMenuForStall } = require("../models/menuTemplates");
const { generateRentalAgreementText } = require("../models/rentalAgreementTemplates");
const { performanceStartDateForGrade, pendingGradeFor } = require("../utils/grading");
const sql = require("mssql");
const { mockTaggedQuery, mockTransaction, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");
jest.mock("../models/menuTemplates");
jest.mock("../models/rentalAgreementTemplates");
jest.mock("../utils/grading");

beforeEach(() => {
  jest.clearAllMocks();
  pendingGradeFor.mockReturnValue(null);
  performanceStartDateForGrade.mockReturnValue(new Date("2023-01-01"));
  generateMenuForStall.mockReturnValue([]);
  generateRentalAgreementText.mockReturnValue("Agreement text");
});

describe("stallModel.getCentres", () => {
  it("should list the hawker centres", async () => {
    const centres = [{ centreId: 1, centreName: "Maxwell Food Centre" }];
    mockTaggedQuery(rows(centres));

    await expect(Stall.getCentres()).resolves.toEqual(centres);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database Error"));

    await expect(Stall.getCentres()).rejects.toThrow("Database Error");
  });
});

describe("stallModel.getStallsByVendor", () => {
  it("should attach the derived pending grade to each stall", async () => {
    pendingGradeFor.mockReturnValue("B");
    mockTaggedQuery(rows([{ stallId: 3, stallName: "Ah Hock", neaGrade: "NEW" }]));

    const stalls = await Stall.getStallsByVendor(5);

    expect(stalls[0].pendingGrade).toBe("B");
  });

  it("should return an empty list for a vendor with no stalls", async () => {
    mockTaggedQuery(rows([]));

    await expect(Stall.getStallsByVendor(5)).resolves.toEqual([]);
  });
});

describe("stallModel.getRequestsByVendor", () => {
  it("should return the vendor's requests newest first", async () => {
    const requests = [{ requestId: 2 }, { requestId: 1 }];
    mockTaggedQuery(rows(requests));

    await expect(Stall.getRequestsByVendor(5)).resolves.toEqual(requests);
  });
});

describe("stallModel.createRequest", () => {
  it("should return true when the request row is inserted", async () => {
    mockTaggedQuery(affected(1));

    await expect(
      Stall.createRequest(5, {
        centreId: 1,
        stallName: "Ah Hock",
        unitNumber: "01-23",
        description: null,
        operatingHours: "08:00 - 20:00",
        hygieneGrade: null,
        imageUrl: "/uploads/stalls/a.png"
      })
    ).resolves.toBe(true);
  });

  it("should return false when nothing was inserted", async () => {
    mockTaggedQuery(affected(0));

    await expect(Stall.createRequest(5, {})).resolves.toBe(false);
  });
});

describe("stallModel.getPendingRequests", () => {
  it("should list requests still awaiting a decision", async () => {
    const requests = [{ requestId: 1, username: "vendor1" }];
    mockTaggedQuery(rows(requests));

    await expect(Stall.getPendingRequests()).resolves.toEqual(requests);
  });
});

describe("stallModel.approveRequest", () => {
  function approvalQueryResults() {
    return [
      rows([{ requestId: 1, centreId: 1, vendorId: 5, stallName: "Ah Hock", unitNumber: "01-23", status: "pending" }]),
      rows([]),
      rows([{ stallId: 3 }]),
      affected(1),
      rows([{ centreName: "Maxwell Food Centre" }]),
      rows([{ username: "operator1" }]),
      rows([{ username: "vendor1" }]),
      affected(1)
    ];
  }

  it("should create the stall and its first rental agreement", async () => {
    mockTaggedQuery(approvalQueryResults());

    await expect(Stall.approveRequest(1, 2, 1500)).resolves.toBe("ok");
    expect(generateRentalAgreementText).toHaveBeenCalledWith(
      expect.objectContaining({ ownerName: "operator1", renterName: "vendor1", rentalPrice: 1500 })
    );
  });

  it("should seed the new stall with a starter menu", async () => {
    generateMenuForStall.mockReturnValue([
      { itemName: "Chicken Rice", price: 4.5, category: "Mains", description: "Tasty" }
    ]);
    mockTaggedQuery([
      rows([{ requestId: 1, centreId: 1, vendorId: 5, stallName: "Ah Hock", unitNumber: "01-23", status: "pending" }]),
      rows([]),
      rows([{ stallId: 3 }]),
      affected(1),
      affected(1),
      rows([{ centreName: "Maxwell Food Centre" }]),
      rows([{ username: "operator1" }]),
      rows([{ username: "vendor1" }]),
      affected(1)
    ]);

    await Stall.approveRequest(1, 2, 1500);

    expect(generateMenuForStall).toHaveBeenCalledWith("Ah Hock", undefined);
  });

  it("should report not found for an unknown request", async () => {
    mockTaggedQuery(rows([]));

    await expect(Stall.approveRequest(999, 2, 1500)).resolves.toBe("not found");
  });

  it("should report already reviewed for a decided request", async () => {
    mockTaggedQuery(rows([{ requestId: 1, status: "approved" }]));

    await expect(Stall.approveRequest(1, 2, 1500)).resolves.toBe("already reviewed");
  });

  it("should report a taken unit number", async () => {
    mockTaggedQuery([
      rows([{ requestId: 1, centreId: 1, unitNumber: "01-23", status: "pending" }]),
      rows([{ stallId: 9 }])
    ]);

    await expect(Stall.approveRequest(1, 2, 1500)).resolves.toBe("unit taken");
  });
});

describe("stallModel.rejectRequest", () => {
  it("should mark the request rejected with the note", async () => {
    mockTaggedQuery([rows([{ requestId: 1, status: "pending" }]), affected(1)]);

    await expect(Stall.rejectRequest(1, "Unit unavailable")).resolves.toBe("ok");
  });

  it("should report not found for an unknown request", async () => {
    mockTaggedQuery(rows([]));

    await expect(Stall.rejectRequest(999, null)).resolves.toBe("not found");
  });

  it("should report already reviewed for a decided request", async () => {
    mockTaggedQuery(rows([{ requestId: 1, status: "rejected" }]));

    await expect(Stall.rejectRequest(1, null)).resolves.toBe("already reviewed");
  });
});

describe("stallModel.getStallForVendor", () => {
  it("should return the stall when the vendor owns it", async () => {
    mockTaggedQuery(rows([{ stallId: 3, stallName: "Ah Hock" }]));

    const stall = await Stall.getStallForVendor(5, 3);

    expect(stall.stallId).toBe(3);
  });

  it("should return undefined when the vendor does not own it", async () => {
    mockTaggedQuery(rows([]));

    await expect(Stall.getStallForVendor(5, 99)).resolves.toBeUndefined();
  });
});

describe("stallModel.getStallStats", () => {
  it("should return the stall's order totals", async () => {
    mockTaggedQuery(rows([{ totalOrders: 12, totalRevenue: 300, thisMonthSales: 80 }]));

    await expect(Stall.getStallStats(3)).resolves.toEqual({
      totalOrders: 12,
      totalRevenue: 300,
      thisMonthSales: 80
    });
  });
});

describe("stallModel.getTopSellingItems", () => {
  it("should return the best sellers by quantity", async () => {
    const items = [{ itemName: "Chicken Rice", totalQuantity: 30 }];
    mockTaggedQuery(rows(items));

    await expect(Stall.getTopSellingItems(3)).resolves.toEqual(items);
  });
});

describe("stallModel menu items", () => {
  it("should return the stall's menu", async () => {
    const menu = [{ menuId: 1, itemName: "Chicken Rice" }];
    mockTaggedQuery(rows(menu));

    await expect(Stall.getStallMenu(3)).resolves.toEqual(menu);
  });

  it("should report a successful menu insert", async () => {
    mockTaggedQuery(affected(1));

    await expect(Stall.addMenuItem(5, 3, { itemName: "Chicken Rice", price: 4.5 })).resolves.toBe(true);
  });

  it("should report a successful menu update", async () => {
    mockTaggedQuery(affected(1));

    await expect(
      Stall.updateMenuItem(3, 1, { itemName: "Chicken Rice", price: 5, available: true })
    ).resolves.toBe(true);
  });

  it("should report a menu update that matched nothing", async () => {
    mockTaggedQuery(affected(0));

    await expect(Stall.updateMenuItem(3, 99, { itemName: "X", price: 1 })).resolves.toBe(false);
  });

  it("should report a successful menu delete", async () => {
    mockTaggedQuery(affected(1));

    await expect(Stall.deleteMenuItem(3, 1)).resolves.toBe(true);
  });
});

describe("stallModel.deleteStall", () => {
  it("should delete every dependent row inside one transaction", async () => {
    mockTaggedQuery(rows([{ stallId: 3 }]));
    const { transaction, request } = mockTransaction(rows([]));

    await expect(Stall.deleteStall(5, 3)).resolves.toBe("ok");
    expect(transaction.begin).toHaveBeenCalledTimes(1);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(request.query.mock.calls.length).toBeGreaterThan(10);
  });

  it("should report not found when the vendor does not own the stall", async () => {
    mockTaggedQuery(rows([]));

    await expect(Stall.deleteStall(5, 99)).resolves.toBe("not found");
  });

  it("should roll back and rethrow when a delete fails", async () => {
    mockTaggedQuery(rows([{ stallId: 3 }]));
    const { transaction } = mockTransaction([rows([]), new Error("Delete failed")]);

    await expect(Stall.deleteStall(5, 3)).rejects.toThrow("Delete failed");
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.commit).not.toHaveBeenCalled();
  });
});

describe("stallModel stock items", () => {
  it("should return the stall's stock", async () => {
    const stock = [{ stockItemId: 1, itemName: "Rice" }];
    mockTaggedQuery(rows(stock));

    await expect(Stall.getStallStock(3)).resolves.toEqual(stock);
  });

  it("should report a successful stock insert", async () => {
    mockTaggedQuery(affected(1));

    await expect(Stall.addStockItem(5, 3, { itemName: "Rice", quantity: 20 })).resolves.toBe(true);
  });

  it("should report a stock update that matched nothing", async () => {
    mockTaggedQuery(affected(0));

    await expect(Stall.updateStockItem(3, 99, { itemName: "Rice", quantity: 5 })).resolves.toBe(false);
  });

  it("should report a successful stock delete", async () => {
    mockTaggedQuery(affected(1));

    await expect(Stall.deleteStockItem(3, 1)).resolves.toBe(true);
  });
});

describe("stallModel.getMonthlyTarget", () => {
  it("should return an empty target when none is set this month", async () => {
    mockTaggedQuery(rows([]));

    await expect(Stall.getMonthlyTarget(3)).resolves.toEqual({
      targetId: null,
      targetType: null,
      targetValue: null,
      progressValue: 0,
      progressPercent: 0
    });
  });

  it("should work out the progress percentage for the target type", async () => {
    mockTaggedQuery([
      rows([{ targetId: 1, targetType: "revenue", targetValue: 1000 }]),
      rows([{ revenue: 400, orders: 12, customers: 8, items: 30 }])
    ]);

    const target = await Stall.getMonthlyTarget(3);

    expect(target.progressValue).toBe(400);
    expect(target.progressPercent).toBe(40);
  });

  it("should cap the progress percentage at 100", async () => {
    mockTaggedQuery([
      rows([{ targetId: 1, targetType: "orders", targetValue: 10 }]),
      rows([{ revenue: 400, orders: 25, customers: 8, items: 30 }])
    ]);

    const target = await Stall.getMonthlyTarget(3);

    expect(target.progressPercent).toBe(100);
  });
});

describe("stallModel.setMonthlyTarget", () => {
  it("should upsert this month's target", async () => {
    mockTaggedQuery(affected(1));

    await expect(
      Stall.setMonthlyTarget(5, 3, { targetType: "revenue", targetValue: 5000 })
    ).resolves.toBe(true);
  });
});

describe("stallModel.getStallsByOperator", () => {
  it("should list the stalls this operator holds agreements for", async () => {
    mockTaggedQuery(rows([{ stallId: 3, stallName: "Ah Hock" }]));

    const stalls = await Stall.getStallsByOperator(2);

    expect(stalls).toHaveLength(1);
    expect(pendingGradeFor).toHaveBeenCalled();
  });
});

describe("stallModel.getStallForOperator", () => {
  it("should return the stall with its latest agreement", async () => {
    mockTaggedQuery([
      rows([{ RentalPrice: 1500, AgreementStartDate: "2026-01-01" }]),
      rows([{ stallId: 3, stallName: "Ah Hock" }])
    ]);

    const stall = await Stall.getStallForOperator(2, 3);

    expect(stall.stallId).toBe(3);
    expect(stall.agreement.RentalPrice).toBe(1500);
  });

  it("should return null when the operator holds no agreement for it", async () => {
    mockTaggedQuery(rows([]));

    await expect(Stall.getStallForOperator(2, 99)).resolves.toBeNull();
  });

  it("should return null when the stall itself is gone", async () => {
    mockTaggedQuery([rows([{ RentalPrice: 1500 }]), rows([])]);

    await expect(Stall.getStallForOperator(2, 3)).resolves.toBeNull();
  });
});
