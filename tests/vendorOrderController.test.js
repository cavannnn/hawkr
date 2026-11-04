const vendorOrderController = require("../controllers/vendorOrderController");
const OrderModel = require("../models/orderModel");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/orderModel");

describe("vendorOrderController.getOrders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should default to the active statuses", async () => {
    const orders = [{ order_id: 1, order_status: "pending" }];
    OrderModel.findByVendor.mockResolvedValue(orders);

    const req = mockRequest({ params: { id: "5" }, query: {} });
    const res = mockResponse();

    await vendorOrderController.getOrders(req, res);

    expect(OrderModel.findByVendor).toHaveBeenCalledWith("5", ["pending", "preparing", "ready"]);
    expect(res.json).toHaveBeenCalledWith({ orders });
  });

  it("should use the history statuses for the history view", async () => {
    OrderModel.findByVendor.mockResolvedValue([]);

    const req = mockRequest({ params: { id: "5" }, query: { view: "history" } });
    const res = mockResponse();

    await vendorOrderController.getOrders(req, res);

    expect(OrderModel.findByVendor).toHaveBeenCalledWith("5", ["completed", "cancelled"]);
  });

  it("should not filter by status for the all view", async () => {
    OrderModel.findByVendor.mockResolvedValue([]);

    const req = mockRequest({ params: { id: "5" }, query: { view: "all" } });
    const res = mockResponse();

    await vendorOrderController.getOrders(req, res);

    expect(OrderModel.findByVendor).toHaveBeenCalledWith("5", null);
  });

  it("should respond 500 when the lookup fails", async () => {
    OrderModel.findByVendor.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" }, query: {} });
    const res = mockResponse();

    await vendorOrderController.getOrders(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("vendorOrderController.updateOrderStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should move an order to a valid status", async () => {
    OrderModel.updateStatusForVendor.mockResolvedValue("ok");

    const req = mockRequest({ params: { id: "5", orderId: "12" }, body: { status: "preparing" } });
    const res = mockResponse();

    await vendorOrderController.updateOrderStatus(req, res);

    expect(OrderModel.updateStatusForVendor).toHaveBeenCalledWith("5", "12", "preparing");
    expect(res.json).toHaveBeenCalledWith({ message: "Order status updated." });
  });

  it("should respond 400 for a status outside the allowed list", async () => {
    const req = mockRequest({ params: { id: "5", orderId: "12" }, body: { status: "shipped" } });
    const res = mockResponse();

    await vendorOrderController.updateOrderStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid order status." });
    expect(OrderModel.updateStatusForVendor).not.toHaveBeenCalled();
  });

  it("should respond 404 when the order is not one of the vendor's", async () => {
    OrderModel.updateStatusForVendor.mockResolvedValue("not found");

    const req = mockRequest({ params: { id: "5", orderId: "12" }, body: { status: "ready" } });
    const res = mockResponse();

    await vendorOrderController.updateOrderStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Order not found, or it doesn't belong to one of your stalls."
    });
  });

  it("should respond 500 when the update fails", async () => {
    OrderModel.updateStatusForVendor.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5", orderId: "12" }, body: { status: "ready" } });
    const res = mockResponse();

    await vendorOrderController.updateOrderStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("vendorOrderController.clearHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should report how many orders were cleared", async () => {
    OrderModel.clearCompletedForVendor.mockResolvedValue(3);

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await vendorOrderController.clearHistory(req, res);

    expect(res.json).toHaveBeenCalledWith({ message: "3 order(s) cleared from history." });
  });

  it("should respond 500 when clearing fails", async () => {
    OrderModel.clearCompletedForVendor.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await vendorOrderController.clearHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});
