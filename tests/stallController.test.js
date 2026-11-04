const stallController = require("../controllers/stallController");
const Stall = require("../models/stallModel");
const Promotion = require("../models/promotionModel");
const Voucher = require("../models/voucherModel");
const RentalAgreement = require("../models/rentalAgreementModel");
const RentalRenewal = require("../models/rentalRenewalModel");
const Review = require("../models/reviewModel");
const { streamAgreementPdf } = require("../utils/rentalAgreementPdf");
const fs = require("fs");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/stallModel");
jest.mock("../models/promotionModel");
jest.mock("../models/voucherModel");
jest.mock("../models/rentalAgreementModel");
jest.mock("../models/rentalRenewalModel");
jest.mock("../models/reviewModel");
jest.mock("../utils/rentalAgreementPdf");
jest.mock("fs");

function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  fs.unlink.mockImplementation((path, cb) => cb && cb());
});

afterEach(() => {
  console.error.mockRestore();
});

describe("stallController.getCentres", () => {
  it("should list the hawker centres for the request form", async () => {
    Stall.getCentres.mockResolvedValue([{ centreId: 1, centreName: "Maxwell Food Centre" }]);

    const req = mockRequest();
    const res = mockResponse();

    await stallController.getCentres(req, res);

    expect(res.json).toHaveBeenCalledWith([{ centreId: 1, centreName: "Maxwell Food Centre" }]);
  });

  it("should respond 500 when the lookup fails", async () => {
    Stall.getCentres.mockRejectedValue(new Error("Database error"));

    const req = mockRequest();
    const res = mockResponse();

    await stallController.getCentres(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("stallController.getMyStalls", () => {
  it("should return the vendor's stalls and requests together", async () => {
    Stall.getStallsByVendor.mockResolvedValue([{ stallId: 3 }]);
    Stall.getRequestsByVendor.mockResolvedValue([{ requestId: 1 }]);

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await stallController.getMyStalls(req, res);

    expect(res.json).toHaveBeenCalledWith({ stalls: [{ stallId: 3 }], requests: [{ requestId: 1 }] });
  });

  it("should respond 500 when the lookup fails", async () => {
    Stall.getStallsByVendor.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await stallController.getMyStalls(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("stallController.createRequest", () => {
  function requestBody(overrides) {
    return Object.assign(
      {
        centreId: 1,
        stallName: " Ah Hock Chicken Rice ",
        unitNumber: " 01-23 ",
        description: " Halal certified ",
        openingTime: "08:00",
        closingTime: "20:00"
      },
      overrides
    );
  }

  it("should create the request from a valid form and image", async () => {
    Stall.createRequest.mockResolvedValue(true);

    const req = mockRequest({
      params: { id: "5" },
      body: requestBody(),
      file: { filename: "stall.png", path: "/tmp/stall.png" }
    });
    const res = mockResponse();

    await stallController.createRequest(req, res);

    expect(Stall.createRequest).toHaveBeenCalledWith("5", {
      centreId: 1,
      stallName: "Ah Hock Chicken Rice",
      unitNumber: "01-23",
      description: "Halal certified",
      operatingHours: "08:00 - 20:00",
      hygieneGrade: null,
      imageUrl: "/uploads/stalls/stall.png"
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should respond 400 when a required field is missing", async () => {
    const req = mockRequest({
      params: { id: "5" },
      body: requestBody({ stallName: "" }),
      file: { filename: "stall.png", path: "/tmp/stall.png" }
    });
    const res = mockResponse();

    await stallController.createRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(fs.unlink).toHaveBeenCalledWith("/tmp/stall.png", expect.any(Function));
    expect(Stall.createRequest).not.toHaveBeenCalled();
  });

  it("should respond 400 when no image was uploaded", async () => {
    const req = mockRequest({ params: { id: "5" }, body: requestBody() });
    const res = mockResponse();

    await stallController.createRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Stall.createRequest).not.toHaveBeenCalled();
  });

  it("should respond 400 for a declared grade outside A or B", async () => {
    const req = mockRequest({
      params: { id: "5" },
      body: requestBody({ hygieneGrade: "C" }),
      file: { filename: "stall.png", path: "/tmp/stall.png" }
    });
    const res = mockResponse();

    await stallController.createRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Declared grade must be A or B, or left blank if not yet graded."
    });
  });

  it("should discard the image and respond 500 when the insert fails", async () => {
    Stall.createRequest.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({
      params: { id: "5" },
      body: requestBody(),
      file: { filename: "stall.png", path: "/tmp/stall.png" }
    });
    const res = mockResponse();

    await stallController.createRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(fs.unlink).toHaveBeenCalledWith("/tmp/stall.png", expect.any(Function));
  });
});

describe("stallController.getStallDetail", () => {
  it("should combine the stall, stats, menu and offers", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3, stallName: "Ah Hock" });
    Stall.getStallStats.mockResolvedValue({ totalOrders: 12 });
    Stall.getTopSellingItems.mockResolvedValue([{ itemName: "Chicken Rice" }]);
    Stall.getStallMenu.mockResolvedValue([{ menuId: 1 }]);
    Stall.getStallStock.mockResolvedValue([{ stockItemId: 1 }]);
    Stall.getMonthlyTarget.mockResolvedValue({ targetId: null });
    Promotion.getPromotionsByStall.mockResolvedValue([]);
    Voucher.getVouchersByStall.mockResolvedValue([]);

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.getStallDetail(req, res);

    const sent = res.json.mock.calls[0][0];
    expect(sent.stallName).toBe("Ah Hock");
    expect(sent.totalOrders).toBe(12);
    expect(sent.topItems).toEqual([{ itemName: "Chicken Rice" }]);
  });

  it("should respond 404 when the vendor does not own the stall", async () => {
    Stall.getStallForVendor.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "5", stallId: "99" } });
    const res = mockResponse();

    await stallController.getStallDetail(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Store not found." });
  });
});

describe("stallController.deleteStall", () => {
  it("should delete the store", async () => {
    Stall.deleteStall.mockResolvedValue("ok");

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.deleteStall(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Store deleted." });
  });

  it("should respond 404 when the vendor does not own the stall", async () => {
    Stall.deleteStall.mockResolvedValue("not found");

    const req = mockRequest({ params: { id: "5", stallId: "99" } });
    const res = mockResponse();

    await stallController.deleteStall(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should respond 500 when the delete fails", async () => {
    Stall.deleteStall.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.deleteStall(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("stallController menu items", () => {
  it("should add a menu item", async () => {
    Stall.addMenuItem.mockResolvedValue(true);

    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: { itemName: " Chicken Rice ", price: 4.5, category: " Mains ", description: " Tasty " }
    });
    const res = mockResponse();

    await stallController.addMenuItem(req, res);

    expect(Stall.addMenuItem).toHaveBeenCalledWith("5", "3", {
      itemName: "Chicken Rice",
      price: 4.5,
      category: "Mains",
      description: "Tasty"
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should respond 400 when the menu item has no price", async () => {
    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: { itemName: "Chicken Rice" } });
    const res = mockResponse();

    await stallController.addMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Item name and price are required." });
  });

  it("should update a menu item", async () => {
    Stall.updateMenuItem.mockResolvedValue(true);

    const req = mockRequest({
      params: { stallId: "3", menuId: "1" },
      body: { itemName: "Chicken Rice", price: 5, available: true }
    });
    const res = mockResponse();

    await stallController.updateMenuItem(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Menu item updated." });
  });

  it("should respond 404 when the menu item does not exist", async () => {
    Stall.updateMenuItem.mockResolvedValue(false);

    const req = mockRequest({
      params: { stallId: "3", menuId: "99" },
      body: { itemName: "Chicken Rice", price: 5 }
    });
    const res = mockResponse();

    await stallController.updateMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should delete a menu item", async () => {
    Stall.deleteMenuItem.mockResolvedValue(true);

    const req = mockRequest({ params: { stallId: "3", menuId: "1" } });
    const res = mockResponse();

    await stallController.deleteMenuItem(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Menu item removed." });
  });

  it("should respond 404 when deleting a menu item that does not exist", async () => {
    Stall.deleteMenuItem.mockResolvedValue(false);

    const req = mockRequest({ params: { stallId: "3", menuId: "99" } });
    const res = mockResponse();

    await stallController.deleteMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("stallController stock items", () => {
  it("should add a stock item", async () => {
    Stall.addStockItem.mockResolvedValue(true);

    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: { itemName: " Rice ", quantity: 20, unit: " kg ", category: null, description: null }
    });
    const res = mockResponse();

    await stallController.addStockItem(req, res);

    expect(Stall.addStockItem).toHaveBeenCalledWith("5", "3", {
      itemName: "Rice",
      quantity: 20,
      unit: "kg",
      category: null,
      description: null
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should accept a quantity of zero", async () => {
    Stall.addStockItem.mockResolvedValue(true);

    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: { itemName: "Rice", quantity: 0 } });
    const res = mockResponse();

    await stallController.addStockItem(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should respond 400 when the quantity is missing", async () => {
    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: { itemName: "Rice" } });
    const res = mockResponse();

    await stallController.addStockItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Item name and quantity are required." });
  });

  it("should update a stock item", async () => {
    Stall.updateStockItem.mockResolvedValue(true);

    const req = mockRequest({
      params: { stallId: "3", stockItemId: "1" },
      body: { itemName: "Rice", quantity: 15, inStock: true }
    });
    const res = mockResponse();

    await stallController.updateStockItem(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Stock item updated." });
  });

  it("should respond 404 when the stock item does not exist", async () => {
    Stall.updateStockItem.mockResolvedValue(false);

    const req = mockRequest({
      params: { stallId: "3", stockItemId: "99" },
      body: { itemName: "Rice", quantity: 15 }
    });
    const res = mockResponse();

    await stallController.updateStockItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should delete a stock item", async () => {
    Stall.deleteStockItem.mockResolvedValue(true);

    const req = mockRequest({ params: { stallId: "3", stockItemId: "1" } });
    const res = mockResponse();

    await stallController.deleteStockItem(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Stock item removed." });
  });

  it("should respond 404 when deleting a stock item that does not exist", async () => {
    Stall.deleteStockItem.mockResolvedValue(false);

    const req = mockRequest({ params: { stallId: "3", stockItemId: "99" } });
    const res = mockResponse();

    await stallController.deleteStockItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("stallController.setMonthlyTarget", () => {
  it("should save a valid target and return the fresh progress", async () => {
    Stall.setMonthlyTarget.mockResolvedValue(true);
    Stall.getMonthlyTarget.mockResolvedValue({ targetId: 1, progressPercent: 0 });

    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: { targetType: "revenue", targetValue: 5000 }
    });
    const res = mockResponse();

    await stallController.setMonthlyTarget(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: "Monthly target saved.",
      target: { targetId: 1, progressPercent: 0 }
    });
  });

  it("should respond 400 for an unknown target type", async () => {
    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: { targetType: "profit", targetValue: 5000 }
    });
    const res = mockResponse();

    await stallController.setMonthlyTarget(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Stall.setMonthlyTarget).not.toHaveBeenCalled();
  });

  it("should respond 400 when the target value is not positive", async () => {
    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: { targetType: "orders", targetValue: 0 }
    });
    const res = mockResponse();

    await stallController.setMonthlyTarget(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("stallController.getStallRental", () => {
  it("should pick out the current and upcoming agreements", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3 });
    RentalAgreement.getAgreementsByStall.mockResolvedValue([
      { AgreementId: 1, AgreementStartDate: daysFromNow(-30), AgreementEndDate: daysFromNow(30) },
      { AgreementId: 2, AgreementStartDate: daysFromNow(31), AgreementEndDate: daysFromNow(200) }
    ]);
    RentalRenewal.hasPendingRenewal.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.getStallRental(req, res);

    const sent = res.json.mock.calls[0][0];
    expect(sent.current.AgreementId).toBe(1);
    expect(sent.upcoming.AgreementId).toBe(2);
    expect(sent.pendingRenewal).toBe(false);
  });

  it("should return nulls when the stall has no agreements", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3 });
    RentalAgreement.getAgreementsByStall.mockResolvedValue([]);

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.getStallRental(req, res);

    expect(res.json).toHaveBeenCalledWith({ current: null, upcoming: null, pendingRenewal: false });
  });

  it("should respond 404 when the vendor does not own the stall", async () => {
    Stall.getStallForVendor.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "5", stallId: "99" } });
    const res = mockResponse();

    await stallController.getStallRental(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("stallController.getStallReviews", () => {
  it("should return the stall's review summary and list", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3 });
    Review.getStallSummary.mockResolvedValue({ review_count: 2, average_rating: 4.5 });
    Review.findByStall.mockResolvedValue([{ review_id: 21 }]);

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.getStallReviews(req, res);

    expect(res.json).toHaveBeenCalledWith({
      summary: { review_count: 2, average_rating: 4.5 },
      reviews: [{ review_id: 21 }]
    });
  });

  it("should respond 404 when the vendor does not own the stall", async () => {
    Stall.getStallForVendor.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "5", stallId: "99" } });
    const res = mockResponse();

    await stallController.getStallReviews(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("stallController.getStallRentalHistory", () => {
  it("should label each agreement Active, Upcoming or Expired", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3 });
    RentalAgreement.getAgreementsByStall.mockResolvedValue([
      { AgreementId: 1, AgreementStartDate: daysFromNow(-400), AgreementEndDate: daysFromNow(-200) },
      { AgreementId: 2, AgreementStartDate: daysFromNow(-30), AgreementEndDate: daysFromNow(30) },
      { AgreementId: 3, AgreementStartDate: daysFromNow(31), AgreementEndDate: daysFromNow(200) }
    ]);

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.getStallRentalHistory(req, res);

    const sent = res.json.mock.calls[0][0];
    expect(sent.map(a => a.status)).toEqual(["Expired", "Active", "Upcoming"]);
  });

  it("should respond 404 when the vendor does not own the stall", async () => {
    Stall.getStallForVendor.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "5", stallId: "99" } });
    const res = mockResponse();

    await stallController.getStallRentalHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("stallController.requestRentalRenewal", () => {
  it("should send a renewal request for the active agreement", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3 });
    RentalAgreement.getAgreementsByStall.mockResolvedValue([
      { AgreementId: 1, AgreementStartDate: daysFromNow(-30), AgreementEndDate: daysFromNow(30) }
    ]);
    RentalRenewal.hasPendingRenewal.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.requestRentalRenewal(req, res);

    expect(RentalRenewal.createRenewalRequest).toHaveBeenCalledWith(1, "3", "5");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should respond 400 when there is no active agreement", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3 });
    RentalAgreement.getAgreementsByStall.mockResolvedValue([]);

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.requestRentalRenewal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "There's no active rental agreement to renew." });
  });

  it("should respond 400 when an upcoming agreement already exists", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3 });
    RentalAgreement.getAgreementsByStall.mockResolvedValue([
      { AgreementId: 1, AgreementStartDate: daysFromNow(-30), AgreementEndDate: daysFromNow(30) },
      { AgreementId: 2, AgreementStartDate: daysFromNow(31), AgreementEndDate: daysFromNow(200) }
    ]);

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.requestRentalRenewal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "An upcoming agreement already exists for this stall." });
  });

  it("should respond 400 when a renewal is already pending", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3 });
    RentalAgreement.getAgreementsByStall.mockResolvedValue([
      { AgreementId: 1, AgreementStartDate: daysFromNow(-30), AgreementEndDate: daysFromNow(30) }
    ]);
    RentalRenewal.hasPendingRenewal.mockResolvedValue(true);

    const req = mockRequest({ params: { id: "5", stallId: "3" } });
    const res = mockResponse();

    await stallController.requestRentalRenewal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(RentalRenewal.createRenewalRequest).not.toHaveBeenCalled();
  });
});

describe("stallController.downloadRentalAgreementPdf", () => {
  it("should stream the agreement for the vendor's own stall", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3, stallName: "Ah Hock" });
    RentalAgreement.getRentalAgreementById.mockResolvedValue({ AgreementId: 1, StallId: 3 });

    const req = mockRequest({ params: { id: "5", stallId: "3", agreementId: "1" } });
    const res = mockResponse();

    await stallController.downloadRentalAgreementPdf(req, res);

    expect(streamAgreementPdf).toHaveBeenCalledWith(res, { AgreementId: 1, StallId: 3 }, "Ah Hock");
  });

  it("should respond 404 when the agreement belongs to another stall", async () => {
    Stall.getStallForVendor.mockResolvedValue({ stallId: 3 });
    RentalAgreement.getRentalAgreementById.mockResolvedValue({ AgreementId: 1, StallId: 99 });

    const req = mockRequest({ params: { id: "5", stallId: "3", agreementId: "1" } });
    const res = mockResponse();

    await stallController.downloadRentalAgreementPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(streamAgreementPdf).not.toHaveBeenCalled();
  });
});

describe("stallController.getPendingRequests", () => {
  it("should list the requests awaiting a decision", async () => {
    Stall.getPendingRequests.mockResolvedValue([{ requestId: 1 }]);

    const req = mockRequest();
    const res = mockResponse();

    await stallController.getPendingRequests(req, res);

    expect(res.json).toHaveBeenCalledWith([{ requestId: 1 }]);
  });

  it("should respond 500 when the lookup fails", async () => {
    Stall.getPendingRequests.mockRejectedValue(new Error("Database error"));

    const req = mockRequest();
    const res = mockResponse();

    await stallController.getPendingRequests(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("stallController.approveRequest", () => {
  it("should approve the request at the operator's rate", async () => {
    Stall.approveRequest.mockResolvedValue("ok");

    const req = mockRequest({ params: { requestId: "1" }, user: { id: 2 }, body: { rentalPrice: 1500 } });
    const res = mockResponse();

    await stallController.approveRequest(req, res);

    expect(Stall.approveRequest).toHaveBeenCalledWith("1", 2, 1500);
    expect(res.json.mock.calls[0][0].message).toContain("Request approved");
  });

  it("should respond 400 without a rental price", async () => {
    const req = mockRequest({ params: { requestId: "1" }, user: { id: 2 }, body: {} });
    const res = mockResponse();

    await stallController.approveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Stall.approveRequest).not.toHaveBeenCalled();
  });

  it("should respond 404 when the request does not exist", async () => {
    Stall.approveRequest.mockResolvedValue("not found");

    const req = mockRequest({ params: { requestId: "99" }, user: { id: 2 }, body: { rentalPrice: 1500 } });
    const res = mockResponse();

    await stallController.approveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Request not found." });
  });

  it("should respond 400 when the request was already reviewed", async () => {
    Stall.approveRequest.mockResolvedValue("already reviewed");

    const req = mockRequest({ params: { requestId: "1" }, user: { id: 2 }, body: { rentalPrice: 1500 } });
    const res = mockResponse();

    await stallController.approveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "This request was already reviewed." });
  });

  it("should respond 400 when the unit number is taken", async () => {
    Stall.approveRequest.mockResolvedValue("unit taken");

    const req = mockRequest({ params: { requestId: "1" }, user: { id: 2 }, body: { rentalPrice: 1500 } });
    const res = mockResponse();

    await stallController.approveRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "That unit number is already used in this hawker centre."
    });
  });
});

describe("stallController.rejectRequest", () => {
  it("should reject the request with a trimmed note", async () => {
    Stall.rejectRequest.mockResolvedValue("ok");

    const req = mockRequest({ params: { requestId: "1" }, body: { reviewNote: "  Unit unavailable  " } });
    const res = mockResponse();

    await stallController.rejectRequest(req, res);

    expect(Stall.rejectRequest).toHaveBeenCalledWith("1", "Unit unavailable");
    expect(res.json).toHaveBeenCalledWith({ message: "Request rejected." });
  });

  it("should pass a null note when none was given", async () => {
    Stall.rejectRequest.mockResolvedValue("ok");

    const req = mockRequest({ params: { requestId: "1" }, body: {} });
    const res = mockResponse();

    await stallController.rejectRequest(req, res);

    expect(Stall.rejectRequest).toHaveBeenCalledWith("1", null);
  });

  it("should respond 404 when the request does not exist", async () => {
    Stall.rejectRequest.mockResolvedValue("not found");

    const req = mockRequest({ params: { requestId: "99" }, body: {} });
    const res = mockResponse();

    await stallController.rejectRequest(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("stallController rental renewals", () => {
  it("should list pending renewals", async () => {
    RentalRenewal.getPendingRenewalRequests.mockResolvedValue([{ RenewalRequestId: 1 }]);

    const req = mockRequest();
    const res = mockResponse();

    await stallController.getPendingRenewals(req, res);

    expect(res.json).toHaveBeenCalledWith([{ RenewalRequestId: 1 }]);
  });

  it("should approve a renewal at the operator's rate", async () => {
    RentalRenewal.approveRenewalRequest.mockResolvedValue("ok");

    const req = mockRequest({ params: { renewalId: "1" }, user: { id: 2 }, body: { rentalPrice: 1800 } });
    const res = mockResponse();

    await stallController.approveRenewal(req, res);

    expect(RentalRenewal.approveRenewalRequest).toHaveBeenCalledWith("1", 2, 1800);
    expect(res.json.mock.calls[0][0].message).toContain("Renewal approved");
  });

  it("should respond 400 without a rental price on approval", async () => {
    const req = mockRequest({ params: { renewalId: "1" }, user: { id: 2 }, body: {} });
    const res = mockResponse();

    await stallController.approveRenewal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(RentalRenewal.approveRenewalRequest).not.toHaveBeenCalled();
  });

  it("should respond 404 when the renewal does not exist", async () => {
    RentalRenewal.approveRenewalRequest.mockResolvedValue("not found");

    const req = mockRequest({ params: { renewalId: "99" }, user: { id: 2 }, body: { rentalPrice: 1800 } });
    const res = mockResponse();

    await stallController.approveRenewal(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Renewal request not found." });
  });

  it("should reject a renewal with a trimmed note", async () => {
    RentalRenewal.rejectRenewalRequest.mockResolvedValue("ok");

    const req = mockRequest({
      params: { renewalId: "1" },
      user: { id: 2 },
      body: { reviewNote: "  Rate under review  " }
    });
    const res = mockResponse();

    await stallController.rejectRenewal(req, res);

    expect(RentalRenewal.rejectRenewalRequest).toHaveBeenCalledWith("1", 2, "Rate under review");
    expect(res.json).toHaveBeenCalledWith({ message: "Renewal rejected." });
  });

  it("should respond 400 when the renewal was already reviewed", async () => {
    RentalRenewal.rejectRenewalRequest.mockResolvedValue("already reviewed");

    const req = mockRequest({ params: { renewalId: "1" }, user: { id: 2 }, body: {} });
    const res = mockResponse();

    await stallController.rejectRenewal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "This renewal request was already reviewed." });
  });
});

describe("stallController operator child stalls", () => {
  it("should list the stalls this operator approved", async () => {
    Stall.getStallsByOperator.mockResolvedValue([{ stallId: 3 }]);

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await stallController.getMyChildren(req, res);

    expect(Stall.getStallsByOperator).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith([{ stallId: 3 }]);
  });

  it("should return one child stall's detail with its stats", async () => {
    Stall.getStallForOperator.mockResolvedValue({ stallId: 3, stallName: "Ah Hock" });
    Stall.getStallStats.mockResolvedValue({ totalOrders: 12 });
    Stall.getTopSellingItems.mockResolvedValue([{ itemName: "Chicken Rice" }]);

    const req = mockRequest({ params: { stallId: "3" }, user: { id: 2 } });
    const res = mockResponse();

    await stallController.getChildDetail(req, res);

    expect(res.json).toHaveBeenCalledWith({
      stallId: 3,
      stallName: "Ah Hock",
      stats: { totalOrders: 12 },
      topItems: [{ itemName: "Chicken Rice" }]
    });
  });

  it("should respond 404 when the operator did not approve the stall", async () => {
    Stall.getStallForOperator.mockResolvedValue(null);

    const req = mockRequest({ params: { stallId: "99" }, user: { id: 2 } });
    const res = mockResponse();

    await stallController.getChildDetail(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Stall not found, or you did not approve it." });
  });
});
