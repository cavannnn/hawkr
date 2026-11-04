const Voucher = require("../models/voucherModel");
const sql = require("mssql");
const { mockTaggedQuery, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("voucherModel.getVouchersByStall", () => {
  it("should return the stall's vouchers", async () => {
    const vouchers = [{ voucherId: 8, code: "SAVE10" }];
    mockTaggedQuery(rows(vouchers));

    await expect(Voucher.getVouchersByStall(3)).resolves.toEqual(vouchers);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database Error"));

    await expect(Voucher.getVouchersByStall(3)).rejects.toThrow("Database Error");
  });
});

describe("voucherModel.addVoucher", () => {
  it("should insert a voucher with a free code", async () => {
    mockTaggedQuery([rows([]), affected(1)]);

    await expect(
      Voucher.addVoucher(5, 3, { code: "SAVE10", discountType: "percentage", discountValue: 10 })
    ).resolves.toBe("ok");
    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("should refuse a code the stall already uses", async () => {
    mockTaggedQuery(rows([{ voucherId: 8 }]));

    await expect(
      Voucher.addVoucher(5, 3, { code: "SAVE10", discountType: "percentage", discountValue: 10 })
    ).resolves.toBe("duplicate code");
    expect(sql.query).toHaveBeenCalledTimes(1);
  });
});

describe("voucherModel.updateVoucher", () => {
  it("should update the voucher", async () => {
    mockTaggedQuery([rows([]), affected(1)]);

    await expect(
      Voucher.updateVoucher(3, 8, { code: "SAVE15", discountType: "percentage", discountValue: 15 })
    ).resolves.toBe("ok");
  });

  it("should refuse a code used by another voucher in the same stall", async () => {
    mockTaggedQuery(rows([{ voucherId: 9 }]));

    await expect(
      Voucher.updateVoucher(3, 8, { code: "SAVE15", discountType: "percentage", discountValue: 15 })
    ).resolves.toBe("duplicate code");
  });

  it("should report not found when no row was updated", async () => {
    mockTaggedQuery([rows([]), affected(0)]);

    await expect(
      Voucher.updateVoucher(3, 99, { code: "SAVE15", discountType: "percentage", discountValue: 15 })
    ).resolves.toBe("not found");
  });
});

describe("voucherModel.deleteVoucher", () => {
  it("should clear redemptions and order links before deleting", async () => {
    mockTaggedQuery([rows([{ voucherId: 8 }]), affected(1), affected(1), affected(1)]);

    await expect(Voucher.deleteVoucher(3, 8)).resolves.toBe(true);
    expect(sql.query).toHaveBeenCalledTimes(4);
  });

  it("should return false when the voucher is not the stall's", async () => {
    mockTaggedQuery(rows([]));

    await expect(Voucher.deleteVoucher(3, 99)).resolves.toBe(false);
    expect(sql.query).toHaveBeenCalledTimes(1);
  });
});

describe("voucherModel.validateVoucher", () => {
  function voucherRow(overrides) {
    return Object.assign(
      {
        voucherId: 8,
        code: "SAVE10",
        discountType: "percentage",
        discountValue: 10,
        minOrderAmount: null,
        usageLimit: null,
        usageCount: 0,
        isActive: true,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        today: "2026-06-01"
      },
      overrides
    );
  }

  it("should reject an empty code without querying", async () => {
    const result = await Voucher.validateVoucher("", 3, 20);

    expect(result).toEqual({ valid: false, message: "Enter a voucher code." });
    expect(sql.query).not.toHaveBeenCalled();
  });

  it("should reject a code that does not exist for the stall", async () => {
    mockTaggedQuery(rows([]));

    const result = await Voucher.validateVoucher("NOPE", 3, 20);

    expect(result.valid).toBe(false);
    expect(result.message).toBe("This voucher code doesn't exist for this stall.");
  });

  it("should reject a switched-off voucher", async () => {
    mockTaggedQuery(rows([voucherRow({ isActive: false })]));

    const result = await Voucher.validateVoucher("SAVE10", 3, 20);

    expect(result.message).toBe("This voucher is no longer active.");
  });

  it("should reject a voucher that has not started", async () => {
    mockTaggedQuery(rows([voucherRow({ startDate: "2026-07-01" })]));

    const result = await Voucher.validateVoucher("SAVE10", 3, 20);

    expect(result.message).toBe("This voucher isn't active yet.");
  });

  it("should reject an expired voucher", async () => {
    mockTaggedQuery(rows([voucherRow({ endDate: "2026-05-01" })]));

    const result = await Voucher.validateVoucher("SAVE10", 3, 20);

    expect(result.message).toBe("This voucher has expired.");
  });

  it("should reject a voucher that has hit its usage limit", async () => {
    mockTaggedQuery(rows([voucherRow({ usageLimit: 5, usageCount: 5 })]));

    const result = await Voucher.validateVoucher("SAVE10", 3, 20);

    expect(result.message).toBe("This voucher has reached its usage limit.");
  });

  it("should reject an order below the minimum spend", async () => {
    mockTaggedQuery(rows([voucherRow({ minOrderAmount: 30 })]));

    const result = await Voucher.validateVoucher("SAVE10", 3, 20);

    expect(result.valid).toBe(false);
    expect(result.message).toBe("This voucher needs a minimum order of $30.00.");
  });

  it("should work out a percentage discount", async () => {
    mockTaggedQuery(rows([voucherRow()]));

    const result = await Voucher.validateVoucher("save10", 3, 25);

    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(2.5);
    expect(result.message).toBe("Voucher applied.");
  });

  it("should work out a fixed discount", async () => {
    mockTaggedQuery(rows([voucherRow({ discountType: "fixed", discountValue: 3 })]));

    const result = await Voucher.validateVoucher("SAVE10", 3, 25);

    expect(result.discountAmount).toBe(3);
  });

  it("should never discount more than the order total", async () => {
    mockTaggedQuery(rows([voucherRow({ discountType: "fixed", discountValue: 50 })]));

    const result = await Voucher.validateVoucher("SAVE10", 3, 10);

    expect(result.discountAmount).toBe(10);
  });
});

describe("voucherModel.redeemVoucher", () => {
  it("should record the redemption and bump the usage count", async () => {
    mockTaggedQuery(affected(1));

    await Voucher.redeemVoucher(8, 12, 2.5);

    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database Error"));

    await expect(Voucher.redeemVoucher(8, 12, 2.5)).rejects.toThrow("Database Error");
  });
});
