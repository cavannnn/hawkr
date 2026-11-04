const promotionController = require("../controllers/promotionController");
const Promotion = require("../models/promotionModel");
const Voucher = require("../models/voucherModel");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/promotionModel");
jest.mock("../models/voucherModel");

function promotionBody(overrides) {
  return Object.assign(
    {
      name: "Lunch Deal",
      description: "10% off",
      discountType: "percentage",
      discountValue: 10,
      scopeType: "all",
      isActive: true,
      startDate: "2026-01-01",
      endDate: "2026-12-31"
    },
    overrides
  );
}

function voucherBody(overrides) {
  return Object.assign(
    {
      code: "save10",
      description: "10% off",
      discountType: "percentage",
      discountValue: 10,
      isActive: true,
      startDate: "2026-01-01",
      endDate: "2026-12-31"
    },
    overrides
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("promotionController.getPromotions", () => {
  it("should return the stall's promotions", async () => {
    const promotions = [{ promotionId: 4, name: "Lunch Deal" }];
    Promotion.getPromotionsByStall.mockResolvedValue(promotions);

    const req = mockRequest({ params: { stallId: "3" } });
    const res = mockResponse();

    await promotionController.getPromotions(req, res);

    expect(Promotion.getPromotionsByStall).toHaveBeenCalledWith("3");
    expect(res.json).toHaveBeenCalledWith(promotions);
  });

  it("should respond 500 when the lookup fails", async () => {
    Promotion.getPromotionsByStall.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { stallId: "3" } });
    const res = mockResponse();

    await promotionController.getPromotions(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("promotionController.addPromotion", () => {
  it("should create a promotion from a valid body", async () => {
    Promotion.addPromotion.mockResolvedValue(true);

    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: promotionBody() });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(Promotion.addPromotion).toHaveBeenCalledWith("5", "3", expect.objectContaining({
      name: "Lunch Deal",
      scopeType: "all",
      scopeCategory: null,
      scopeMenuIds: []
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "Promotion created." });
  });

  it("should respond 400 when the name is blank", async () => {
    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: promotionBody({ name: "   " }) });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Promotion name is required." });
    expect(Promotion.addPromotion).not.toHaveBeenCalled();
  });

  it("should respond 400 for an unknown discount type", async () => {
    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: promotionBody({ discountType: "bogof" })
    });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Discount type must be percentage or fixed." });
  });

  it("should respond 400 for a percentage discount over 100", async () => {
    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: promotionBody({ discountValue: 150 })
    });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "A percentage discount can't be more than 100." });
  });

  it("should respond 400 when the discount value is not positive", async () => {
    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: promotionBody({ discountValue: 0 })
    });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Discount value must be greater than 0." });
  });

  it("should respond 400 when the end date is not after the start date", async () => {
    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: promotionBody({ startDate: "2026-06-01", endDate: "2026-06-01" })
    });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "End date must be after the start date." });
  });

  it("should respond 400 when a category scope has no category", async () => {
    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: promotionBody({ scopeType: "category" })
    });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Pick a category for this promotion." });
  });

  it("should respond 400 when an item scope has no items", async () => {
    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: promotionBody({ scopeType: "items", scopeMenuIds: [] })
    });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Pick at least one menu item for this promotion." });
  });

  it("should fall back to the all scope for an unknown scope type", async () => {
    Promotion.addPromotion.mockResolvedValue(true);

    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: promotionBody({ scopeType: "everything" })
    });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(Promotion.addPromotion.mock.calls[0][2].scopeType).toBe("all");
  });

  it("should respond 500 when the insert fails", async () => {
    Promotion.addPromotion.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: promotionBody() });
    const res = mockResponse();

    await promotionController.addPromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("promotionController.updatePromotion", () => {
  it("should update an existing promotion", async () => {
    Promotion.updatePromotion.mockResolvedValue(true);

    const req = mockRequest({ params: { stallId: "3", promotionId: "4" }, body: promotionBody() });
    const res = mockResponse();

    await promotionController.updatePromotion(req, res);

    expect(Promotion.updatePromotion).toHaveBeenCalledWith("3", "4", expect.any(Object));
    expect(res.json).toHaveBeenCalledWith({ message: "Promotion updated." });
  });

  it("should respond 404 when the promotion does not exist", async () => {
    Promotion.updatePromotion.mockResolvedValue(false);

    const req = mockRequest({ params: { stallId: "3", promotionId: "99" }, body: promotionBody() });
    const res = mockResponse();

    await promotionController.updatePromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Promotion not found." });
  });

  it("should respond 400 for an invalid date range", async () => {
    const req = mockRequest({
      params: { stallId: "3", promotionId: "4" },
      body: promotionBody({ endDate: "2025-01-01" })
    });
    const res = mockResponse();

    await promotionController.updatePromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Promotion.updatePromotion).not.toHaveBeenCalled();
  });

  it("should respond 500 when the update fails", async () => {
    Promotion.updatePromotion.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { stallId: "3", promotionId: "4" }, body: promotionBody() });
    const res = mockResponse();

    await promotionController.updatePromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("promotionController.deletePromotion", () => {
  it("should remove the promotion", async () => {
    Promotion.deletePromotion.mockResolvedValue(true);

    const req = mockRequest({ params: { stallId: "3", promotionId: "4" } });
    const res = mockResponse();

    await promotionController.deletePromotion(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Promotion removed." });
  });

  it("should respond 404 when the promotion does not exist", async () => {
    Promotion.deletePromotion.mockResolvedValue(false);

    const req = mockRequest({ params: { stallId: "3", promotionId: "99" } });
    const res = mockResponse();

    await promotionController.deletePromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should respond 500 when the delete fails", async () => {
    Promotion.deletePromotion.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { stallId: "3", promotionId: "4" } });
    const res = mockResponse();

    await promotionController.deletePromotion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("promotionController.getVouchers", () => {
  it("should return the stall's vouchers", async () => {
    const vouchers = [{ voucherId: 8, code: "SAVE10" }];
    Voucher.getVouchersByStall.mockResolvedValue(vouchers);

    const req = mockRequest({ params: { stallId: "3" } });
    const res = mockResponse();

    await promotionController.getVouchers(req, res);

    expect(res.json).toHaveBeenCalledWith(vouchers);
  });

  it("should respond 500 when the lookup fails", async () => {
    Voucher.getVouchersByStall.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { stallId: "3" } });
    const res = mockResponse();

    await promotionController.getVouchers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("promotionController.addVoucher", () => {
  it("should upper-case the code and create the voucher", async () => {
    Voucher.addVoucher.mockResolvedValue("ok");

    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: voucherBody() });
    const res = mockResponse();

    await promotionController.addVoucher(req, res);

    expect(Voucher.addVoucher).toHaveBeenCalledWith("5", "3", expect.objectContaining({ code: "SAVE10" }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "Voucher created." });
  });

  it("should respond 400 when the code is blank", async () => {
    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: voucherBody({ code: "  " }) });
    const res = mockResponse();

    await promotionController.addVoucher(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Voucher code is required." });
  });

  it("should respond 400 when the stall already uses that code", async () => {
    Voucher.addVoucher.mockResolvedValue("duplicate code");

    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: voucherBody() });
    const res = mockResponse();

    await promotionController.addVoucher(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "This stall already has a voucher with that code." });
  });

  it("should respond 400 for an invalid discount", async () => {
    const req = mockRequest({
      params: { id: "5", stallId: "3" },
      body: voucherBody({ discountType: "bogof" })
    });
    const res = mockResponse();

    await promotionController.addVoucher(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Voucher.addVoucher).not.toHaveBeenCalled();
  });

  it("should respond 500 when the insert fails", async () => {
    Voucher.addVoucher.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5", stallId: "3" }, body: voucherBody() });
    const res = mockResponse();

    await promotionController.addVoucher(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("promotionController.updateVoucher", () => {
  it("should update an existing voucher", async () => {
    Voucher.updateVoucher.mockResolvedValue("ok");

    const req = mockRequest({ params: { stallId: "3", voucherId: "8" }, body: voucherBody() });
    const res = mockResponse();

    await promotionController.updateVoucher(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Voucher updated." });
  });

  it("should respond 400 when the new code collides", async () => {
    Voucher.updateVoucher.mockResolvedValue("duplicate code");

    const req = mockRequest({ params: { stallId: "3", voucherId: "8" }, body: voucherBody() });
    const res = mockResponse();

    await promotionController.updateVoucher(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should respond 404 when the voucher does not exist", async () => {
    Voucher.updateVoucher.mockResolvedValue("not found");

    const req = mockRequest({ params: { stallId: "3", voucherId: "99" }, body: voucherBody() });
    const res = mockResponse();

    await promotionController.updateVoucher(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Voucher not found." });
  });

  it("should respond 500 when the update fails", async () => {
    Voucher.updateVoucher.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { stallId: "3", voucherId: "8" }, body: voucherBody() });
    const res = mockResponse();

    await promotionController.updateVoucher(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("promotionController.deleteVoucher", () => {
  it("should remove the voucher", async () => {
    Voucher.deleteVoucher.mockResolvedValue(true);

    const req = mockRequest({ params: { stallId: "3", voucherId: "8" } });
    const res = mockResponse();

    await promotionController.deleteVoucher(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "Voucher removed." });
  });

  it("should respond 404 when the voucher does not exist", async () => {
    Voucher.deleteVoucher.mockResolvedValue(false);

    const req = mockRequest({ params: { stallId: "3", voucherId: "99" } });
    const res = mockResponse();

    await promotionController.deleteVoucher(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should respond 500 when the delete fails", async () => {
    Voucher.deleteVoucher.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { stallId: "3", voucherId: "8" } });
    const res = mockResponse();

    await promotionController.deleteVoucher(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
