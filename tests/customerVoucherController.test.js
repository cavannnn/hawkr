const CustomerVoucherController = require("../controllers/customerVoucherController");
const VoucherModel = require("../models/voucherModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/voucherModel");

describe("CustomerVoucherController.validate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the discount details for a valid voucher", async () => {
    VoucherModel.validateVoucher.mockResolvedValue({
      valid: true,
      message: "Voucher applied.",
      discountAmount: 2.5,
      voucher: {
        code: "SAVE10",
        discountType: "percentage",
        discountValue: 10,
        minOrderAmount: 20
      }
    });

    const req = mockRequest({ body: { code: "SAVE10", stall_id: "3", order_amount: 25 } });
    const res = mockResponse();

    await CustomerVoucherController.validate(req, res, mockNext());

    expect(VoucherModel.validateVoucher).toHaveBeenCalledWith("SAVE10", 3, 25);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      valid: true,
      message: "Voucher applied.",
      data: {
        code: "SAVE10",
        discount_type: "percentage",
        discount_value: 10,
        min_order_amount: 20,
        discount_amount: 2.5
      }
    });
  });

  it("should return a null minimum order amount when the voucher has none", async () => {
    VoucherModel.validateVoucher.mockResolvedValue({
      valid: true,
      message: "Voucher applied.",
      discountAmount: 1,
      voucher: { code: "ONE", discountType: "fixed", discountValue: 1, minOrderAmount: null }
    });

    const req = mockRequest({ body: { code: "ONE", stall_id: 3, order_amount: 10 } });
    const res = mockResponse();

    await CustomerVoucherController.validate(req, res, mockNext());

    expect(res.json.mock.calls[0][0].data.min_order_amount).toBeNull();
  });

  it("should default a missing order amount to 0", async () => {
    VoucherModel.validateVoucher.mockResolvedValue({ valid: false, message: "This voucher has expired." });

    const req = mockRequest({ body: { code: "OLD", stall_id: 3 } });
    const res = mockResponse();

    await CustomerVoucherController.validate(req, res, mockNext());

    expect(VoucherModel.validateVoucher).toHaveBeenCalledWith("OLD", 3, 0);
  });

  it("should return a null payload when the voucher is not valid", async () => {
    VoucherModel.validateVoucher.mockResolvedValue({ valid: false, message: "This voucher has expired." });

    const req = mockRequest({ body: { code: "OLD", stall_id: 3, order_amount: 12 } });
    const res = mockResponse();

    await CustomerVoucherController.validate(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      valid: false,
      message: "This voucher has expired.",
      data: null
    });
  });

  it("should respond 400 when stall_id is missing", async () => {
    const req = mockRequest({ body: { code: "SAVE10" } });
    const res = mockResponse();

    await CustomerVoucherController.validate(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      valid: false,
      message: "stall_id is required"
    });
    expect(VoucherModel.validateVoucher).not.toHaveBeenCalled();
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    VoucherModel.validateVoucher.mockRejectedValue(error);

    const req = mockRequest({ body: { code: "SAVE10", stall_id: 3 } });
    const res = mockResponse();
    const next = mockNext();

    await CustomerVoucherController.validate(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
