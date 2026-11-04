const OrderModel = require("../models/orderModel");
const MenuModel = require("../models/menuModel");
const StallModel = require("../models/customerStallModel");
const VoucherModel = require("../models/voucherModel");
const NotificationModel = require("../models/notificationModel");
const sql = require("mssql");
const { mockPool, mockTransaction, mockConnectionError, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");
jest.mock("../models/menuModel");
jest.mock("../models/customerStallModel");
jest.mock("../models/voucherModel");
jest.mock("../models/notificationModel");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

function orderPayload(overrides) {
  return Object.assign(
    {
      stall_id: 3,
      hawker_id: 1,
      customer_id: 7,
      customer_name: "Jaslyn",
      customer_phone: "91234567",
      items: [{ menu_id: 1, quantity: 2 }],
      payment_method: "paynow"
    },
    overrides
  );
}

function availableMenuItem(overrides) {
  return Object.assign(
    { menu_id: 1, item_name: "Chicken Rice", price: 5, is_available: 1 },
    overrides
  );
}

describe("OrderModel.create", () => {
  it("should price the order from the menu and return the new order id", async () => {
    StallModel.findByCompositeKey.mockResolvedValue({ stall_id: 3, stall_name: "Ah Hock" });
    MenuModel.findByCompositeKey.mockResolvedValue(availableMenuItem());
    const { request } = mockPool([rows([{ vendorId: 5 }]), rows([{ order_id: 12 }]), affected(1)]);

    const orderId = await OrderModel.create(orderPayload());

    expect(orderId).toBe(12);
    expect(request.input).toHaveBeenCalledWith("totalAmount", undefined, 10);
  });

  it("should notify the vendor that a new order arrived", async () => {
    StallModel.findByCompositeKey.mockResolvedValue({ stall_id: 3, stall_name: "Ah Hock" });
    MenuModel.findByCompositeKey.mockResolvedValue(availableMenuItem());
    mockPool([rows([{ vendorId: 5 }]), rows([{ order_id: 12 }]), affected(1)]);

    await OrderModel.create(orderPayload());

    expect(NotificationModel.createNotification).toHaveBeenCalledWith(
      5,
      "order",
      "New order received",
      expect.stringContaining("Ah Hock"),
      "orders.html",
      "order",
      12
    );
  });

  it("should reject an order for a stall that is not in that centre", async () => {
    StallModel.findByCompositeKey.mockResolvedValue(null);
    mockPool(rows([]));

    await expect(OrderModel.create(orderPayload())).rejects.toThrow(
      "Stall 3 not found in hawker 1"
    );
  });

  it("should reject an order containing an unknown menu item", async () => {
    StallModel.findByCompositeKey.mockResolvedValue({ stall_id: 3 });
    MenuModel.findByCompositeKey.mockResolvedValue(null);
    mockPool(rows([{ vendorId: 5 }]));

    await expect(OrderModel.create(orderPayload())).rejects.toThrow(
      "Menu item 1 not found in stall 3"
    );
  });

  it("should reject an order containing a sold-out item", async () => {
    StallModel.findByCompositeKey.mockResolvedValue({ stall_id: 3 });
    MenuModel.findByCompositeKey.mockResolvedValue(availableMenuItem({ is_available: 0 }));
    mockPool(rows([{ vendorId: 5 }]));

    await expect(OrderModel.create(orderPayload())).rejects.toThrow(
      'Menu item "Chicken Rice" is currently not available'
    );
  });

  it("should apply and redeem a valid voucher", async () => {
    StallModel.findByCompositeKey.mockResolvedValue({ stall_id: 3, stall_name: "Ah Hock" });
    MenuModel.findByCompositeKey.mockResolvedValue(availableMenuItem());
    VoucherModel.validateVoucher.mockResolvedValue({
      valid: true,
      discountAmount: 2,
      voucher: { voucherId: 8 }
    });
    const { request } = mockPool([rows([{ vendorId: 5 }]), rows([{ order_id: 12 }]), affected(1)]);

    await OrderModel.create(orderPayload({ voucher_code: "SAVE10" }));

    expect(request.input).toHaveBeenCalledWith("discountAmount", undefined, 2);
    expect(request.input).toHaveBeenCalledWith("totalAmount", undefined, 8);
    expect(VoucherModel.redeemVoucher).toHaveBeenCalledWith(8, 12, 2);
  });

  it("should reject the whole order when the voucher no longer validates", async () => {
    StallModel.findByCompositeKey.mockResolvedValue({ stall_id: 3 });
    MenuModel.findByCompositeKey.mockResolvedValue(availableMenuItem());
    VoucherModel.validateVoucher.mockResolvedValue({ valid: false, message: "This voucher has expired." });
    mockPool(rows([{ vendorId: 5 }]));

    await expect(
      OrderModel.create(orderPayload({ voucher_code: "OLD" }))
    ).rejects.toMatchObject({ message: "This voucher has expired.", statusCode: 400 });
  });

  it("should cap a round-up at the next whole dollar", async () => {
    StallModel.findByCompositeKey.mockResolvedValue({ stall_id: 3, stall_name: "Ah Hock" });
    MenuModel.findByCompositeKey.mockResolvedValue(availableMenuItem({ price: 4.7 }));
    const { request } = mockPool([rows([{ vendorId: 5 }]), rows([{ order_id: 12 }]), affected(1)]);

    await OrderModel.create(orderPayload({ items: [{ menu_id: 1, quantity: 1 }], round_up: 5 }));

    expect(request.input).toHaveBeenCalledWith("roundUpAmount", undefined, 0.3);
    expect(request.input).toHaveBeenCalledWith("totalAmount", undefined, 5);
  });

  it("should ignore a negative round-up", async () => {
    StallModel.findByCompositeKey.mockResolvedValue({ stall_id: 3, stall_name: "Ah Hock" });
    MenuModel.findByCompositeKey.mockResolvedValue(availableMenuItem());
    const { request } = mockPool([rows([{ vendorId: 5 }]), rows([{ order_id: 12 }]), affected(1)]);

    await OrderModel.create(orderPayload({ round_up: -3 }));

    expect(request.input).toHaveBeenCalledWith("roundUpAmount", undefined, 0);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(OrderModel.create(orderPayload())).rejects.toThrow("Database Error");
  });
});

describe("OrderModel.findById", () => {
  it("should parse the nested order item JSON", async () => {
    const { request } = mockPool(rows([
      { order_id: 12, items: JSON.stringify([{ order_item_id: 1, item_name: "Chicken Rice" }]) }
    ]));

    const order = await OrderModel.findById(12);

    expect(request.input).toHaveBeenCalledWith("orderId", sql.Int, 12);
    expect(order.items).toEqual([{ order_item_id: 1, item_name: "Chicken Rice" }]);
  });

  it("should default to an empty item list", async () => {
    mockPool(rows([{ order_id: 12, items: null }]));

    const order = await OrderModel.findById(12);

    expect(order.items).toEqual([]);
  });

  it("should return null when the order does not exist", async () => {
    mockPool(rows([]));

    await expect(OrderModel.findById(999)).resolves.toBeNull();
  });
});

describe("OrderModel.findAll", () => {
  it("should return every order when no filters are given", async () => {
    const orders = [{ order_id: 12 }];
    const { request } = mockPool(rows(orders));

    const result = await OrderModel.findAll();

    expect(request.query.mock.calls[0][0]).not.toContain("o.customerId = @customerId");
    expect(result).toEqual(orders);
  });

  it("should scope the list to one customer", async () => {
    const { request } = mockPool(rows([]));

    await OrderModel.findAll({ customer_id: 7 });

    expect(request.input).toHaveBeenCalledWith("customerId", sql.Int, 7);
    expect(request.query.mock.calls[0][0]).toContain("o.customerId = @customerId");
  });

  it("should apply the name, centre and stall filters", async () => {
    const { request } = mockPool(rows([]));

    await OrderModel.findAll({ customer_name: "Jaslyn", hawker_id: 1, stall_id: 3 });

    const query = request.query.mock.calls[0][0];
    expect(query).toContain("o.customerName LIKE @customerName");
    expect(query).toContain("s.centreId = @hawkerId");
    expect(query).toContain("o.stallId = @stallId");
    expect(request.input).toHaveBeenCalledWith("customerName", undefined, "%Jaslyn%");
  });
});

describe("OrderModel.findByVendor", () => {
  it("should parse the nested item JSON on each order", async () => {
    mockPool(rows([
      { order_id: 12, items: JSON.stringify([{ item_name: "Chicken Rice" }]) },
      { order_id: 13, items: null }
    ]));

    const orders = await OrderModel.findByVendor(5);

    expect(orders[0].items).toEqual([{ item_name: "Chicken Rice" }]);
    expect(orders[1].items).toEqual([]);
  });

  it("should filter by the given statuses", async () => {
    const { request } = mockPool(rows([]));

    await OrderModel.findByVendor(5, ["pending", "ready"]);

    expect(request.input).toHaveBeenCalledWith("status0", undefined, "pending");
    expect(request.input).toHaveBeenCalledWith("status1", undefined, "ready");
    expect(request.query.mock.calls[0][0]).toContain("AND o.status IN (@status0, @status1)");
  });

  it("should not filter when no statuses are given", async () => {
    const { request } = mockPool(rows([]));

    await OrderModel.findByVendor(5, null);

    expect(request.query.mock.calls[0][0]).not.toContain("o.status IN");
  });
});

describe("OrderModel.updateStatusForVendor", () => {
  it("should update an order placed at one of the vendor's stalls", async () => {
    mockPool([rows([{ orderId: 12 }]), affected(1)]);

    await expect(OrderModel.updateStatusForVendor(5, 12, "ready")).resolves.toBe("ok");
  });

  it("should report not found for another vendor's order", async () => {
    mockPool(rows([]));

    await expect(OrderModel.updateStatusForVendor(5, 12, "ready")).resolves.toBe("not found");
  });
});

describe("OrderModel.clearCompletedForVendor", () => {
  it("should return zero when there is nothing to clear", async () => {
    mockPool(rows([]));

    await expect(OrderModel.clearCompletedForVendor(5)).resolves.toBe(0);
  });

  it("should delete the resolved orders inside one transaction", async () => {
    mockPool(rows([{ orderId: 12 }, { orderId: 13 }]));
    const { transaction, request } = mockTransaction(rows([]));

    await expect(OrderModel.clearCompletedForVendor(5)).resolves.toBe(2);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(request.query).toHaveBeenCalledTimes(4);
  });

  it("should roll back and rethrow when a delete fails", async () => {
    mockPool(rows([{ orderId: 12 }]));
    const { transaction } = mockTransaction([rows([]), new Error("Delete failed")]);

    await expect(OrderModel.clearCompletedForVendor(5)).rejects.toThrow("Delete failed");
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
  });
});

describe("OrderModel.updateStatus", () => {
  it("should update an existing order", async () => {
    mockPool([rows([{ orderId: 12 }]), affected(1)]);

    await expect(OrderModel.updateStatus(12, "ready")).resolves.toBe(true);
  });

  it("should return null when the order does not exist", async () => {
    mockPool(rows([]));

    await expect(OrderModel.updateStatus(999, "ready")).resolves.toBeNull();
  });
});

describe("OrderModel.delete", () => {
  it("should delete a cancelled order", async () => {
    mockPool([rows([{ orderId: 12, status: "cancelled" }]), affected(1)]);

    await expect(OrderModel.delete(12)).resolves.toBe(true);
  });

  it("should return null when the order does not exist", async () => {
    mockPool(rows([]));

    await expect(OrderModel.delete(999)).resolves.toBeNull();
  });

  it("should refuse to delete an order that is not cancelled", async () => {
    mockPool(rows([{ orderId: 12, status: "completed" }]));

    await expect(OrderModel.delete(12)).rejects.toThrow("Only cancelled orders can be deleted");
  });
});
