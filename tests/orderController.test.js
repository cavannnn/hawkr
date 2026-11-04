const OrderController = require("../controllers/orderController");
const OrderModel = require("../models/orderModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/orderModel");

describe("OrderController.createOrder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.log.mockRestore();
    console.error.mockRestore();
  });

  it("should stamp a signed-in customer's id onto the order", async () => {
    OrderModel.create.mockResolvedValue(12);
    OrderModel.findById.mockResolvedValue({ order_id: 12 });

    const req = mockRequest({
      user: { id: 7, role: "customer" },
      body: { stall_id: 3, hawker_id: 1, items: [] }
    });
    const res = mockResponse();

    await OrderController.createOrder(req, res, mockNext());

    expect(OrderModel.create).toHaveBeenCalledWith({
      stall_id: 3,
      hawker_id: 1,
      items: [],
      customer_id: 7
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Order created successfully",
      data: { order_id: 12 }
    });
  });

  it("should leave the body untouched for a vendor ringing up a walk-in", async () => {
    OrderModel.create.mockResolvedValue(12);
    OrderModel.findById.mockResolvedValue({ order_id: 12 });

    const body = { stall_id: 3, hawker_id: 1, customer_name: "Walk-in", items: [] };
    const req = mockRequest({ user: { id: 5, role: "vendor" }, body });
    const res = mockResponse();

    await OrderController.createOrder(req, res, mockNext());

    expect(OrderModel.create).toHaveBeenCalledWith(body);
  });

  it("should relay the status code carried by a model error", async () => {
    const error = new Error("This voucher has expired.");
    error.statusCode = 400;
    OrderModel.create.mockRejectedValue(error);

    const req = mockRequest({ body: { stall_id: 3 } });
    const res = mockResponse();
    const next = mockNext();

    await OrderController.createOrder(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "This voucher has expired." });
    expect(next).not.toHaveBeenCalled();
  });

  it("should pass an unexpected failure to the error handler", async () => {
    const error = new Error("Database error");
    OrderModel.create.mockRejectedValue(error);

    const req = mockRequest({ body: { stall_id: 3 } });
    const res = mockResponse();
    const next = mockNext();

    await OrderController.createOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("OrderController.getOrder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the order", async () => {
    const order = { order_id: 12, customer_id: 7 };
    OrderModel.findById.mockResolvedValue(order);

    const req = mockRequest({ params: { orderId: "12" }, user: { id: 7, role: "customer" } });
    const res = mockResponse();

    await OrderController.getOrder(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({ success: true, data: order });
  });

  it("should respond 404 when the order does not exist", async () => {
    OrderModel.findById.mockResolvedValue(null);

    const req = mockRequest({ params: { orderId: "999" }, user: { id: 7, role: "customer" } });
    const res = mockResponse();

    await OrderController.getOrder(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Order not found" });
  });

  it("should hide another customer's order behind a 404", async () => {
    OrderModel.findById.mockResolvedValue({ order_id: 12, customer_id: 99 });

    const req = mockRequest({ params: { orderId: "12" }, user: { id: 7, role: "customer" } });
    const res = mockResponse();

    await OrderController.getOrder(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Order not found" });
  });

  it("should let a vendor read an order they did not place", async () => {
    const order = { order_id: 12, customer_id: 99 };
    OrderModel.findById.mockResolvedValue(order);

    const req = mockRequest({ params: { orderId: "12" }, user: { id: 5, role: "vendor" } });
    const res = mockResponse();

    await OrderController.getOrder(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({ success: true, data: order });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    OrderModel.findById.mockRejectedValue(error);

    const req = mockRequest({ params: { orderId: "12" } });
    const res = mockResponse();
    const next = mockNext();

    await OrderController.getOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("OrderController.getUserOrders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return one customer's orders with a count", async () => {
    const orders = [{ order_id: 12 }, { order_id: 13 }];
    OrderModel.findAll.mockResolvedValue(orders);

    const req = mockRequest({ params: { userId: "7" }, query: { hawker_id: "1", stall_id: "3" } });
    const res = mockResponse();

    await OrderController.getUserOrders(req, res, mockNext());

    expect(OrderModel.findAll).toHaveBeenCalledWith({ customer_id: 7, hawker_id: "1", stall_id: "3" });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: orders, count: 2 });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    OrderModel.findAll.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" }, query: {} });
    const res = mockResponse();
    const next = mockNext();

    await OrderController.getUserOrders(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("OrderController.getOrders", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should scope a customer's token to their own orders", async () => {
    OrderModel.findAll.mockResolvedValue([]);

    const req = mockRequest({ query: {}, user: { id: 7, role: "customer" } });
    const res = mockResponse();

    await OrderController.getOrders(req, res, mockNext());

    expect(OrderModel.findAll).toHaveBeenCalledWith({
      customer_id: 7,
      customer_name: undefined,
      hawker_id: undefined,
      stall_id: undefined
    });
  });

  it("should not scope by customer for a vendor", async () => {
    OrderModel.findAll.mockResolvedValue([]);

    const req = mockRequest({ query: { stall_id: "3" }, user: { id: 5, role: "vendor" } });
    const res = mockResponse();

    await OrderController.getOrders(req, res, mockNext());

    expect(OrderModel.findAll.mock.calls[0][0].customer_id).toBeUndefined();
  });

  it("should return an empty list for a guest", async () => {
    const req = mockRequest({ query: {}, user: { id: "guest", role: "guest" } });
    const res = mockResponse();

    await OrderController.getOrders(req, res, mockNext());

    expect(OrderModel.findAll).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it("should return an empty list when there is no token at all", async () => {
    const req = mockRequest({ query: {} });
    const res = mockResponse();

    await OrderController.getOrders(req, res, mockNext());

    expect(OrderModel.findAll).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });
});

describe("OrderController.updateOrderStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should update the status and return the fresh order", async () => {
    OrderModel.updateStatus.mockResolvedValue(true);
    OrderModel.findById.mockResolvedValue({ order_id: 12, order_status: "ready" });

    const req = mockRequest({ params: { orderId: "12" }, body: { order_status: "ready" } });
    const res = mockResponse();

    await OrderController.updateOrderStatus(req, res, mockNext());

    expect(OrderModel.updateStatus).toHaveBeenCalledWith("12", "ready");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Order status updated successfully",
      data: { order_id: 12, order_status: "ready" }
    });
  });

  it("should respond 404 when the order does not exist", async () => {
    OrderModel.updateStatus.mockResolvedValue(null);

    const req = mockRequest({ params: { orderId: "999" }, body: { order_status: "ready" } });
    const res = mockResponse();

    await OrderController.updateOrderStatus(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Order not found" });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    OrderModel.updateStatus.mockRejectedValue(error);

    const req = mockRequest({ params: { orderId: "12" }, body: { order_status: "ready" } });
    const res = mockResponse();
    const next = mockNext();

    await OrderController.updateOrderStatus(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("OrderController.deleteOrder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete a cancelled order", async () => {
    OrderModel.delete.mockResolvedValue(true);

    const req = mockRequest({ params: { orderId: "12" } });
    const res = mockResponse();

    await OrderController.deleteOrder(req, res, mockNext());

    expect(OrderModel.delete).toHaveBeenCalledWith("12");
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Order deleted successfully" });
  });

  it("should respond 404 when the order does not exist", async () => {
    OrderModel.delete.mockResolvedValue(null);

    const req = mockRequest({ params: { orderId: "999" } });
    const res = mockResponse();

    await OrderController.deleteOrder(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Order not found" });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Only cancelled orders can be deleted");
    OrderModel.delete.mockRejectedValue(error);

    const req = mockRequest({ params: { orderId: "12" } });
    const res = mockResponse();
    const next = mockNext();

    await OrderController.deleteOrder(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
