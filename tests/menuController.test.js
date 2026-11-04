const MenuController = require("../controllers/menuController");
const MenuModel = require("../models/menuModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/menuModel");

describe("MenuController.getMenuByStall", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the stall's menu", async () => {
    const menu = [
      { menu_id: 1, item_name: "Chicken Rice", price: 4.5 },
      { menu_id: 2, item_name: "Iced Milo", price: 1.8 }
    ];
    MenuModel.findByStallId.mockResolvedValue(menu);

    const req = mockRequest({ params: { stallId: "3" }, query: {} });
    const res = mockResponse();

    await MenuController.getMenuByStall(req, res, mockNext());

    expect(MenuModel.findByStallId).toHaveBeenCalledWith(3, null);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: menu });
  });

  it("should pass the hawker id through when supplied", async () => {
    MenuModel.findByStallId.mockResolvedValue([]);

    const req = mockRequest({ params: { stallId: "3" }, query: { hawker_id: "1" } });
    const res = mockResponse();

    await MenuController.getMenuByStall(req, res, mockNext());

    expect(MenuModel.findByStallId).toHaveBeenCalledWith(3, 1);
  });

  it("should return an empty list when the model returns nothing", async () => {
    MenuModel.findByStallId.mockResolvedValue(null);

    const req = mockRequest({ params: { stallId: "3" }, query: {} });
    const res = mockResponse();

    await MenuController.getMenuByStall(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({ success: true, data: [] });
  });

  it("should respond 400 for a non-numeric stall id", async () => {
    const req = mockRequest({ params: { stallId: "abc" }, query: {} });
    const res = mockResponse();

    await MenuController.getMenuByStall(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Invalid stall ID provided" });
    expect(MenuModel.findByStallId).not.toHaveBeenCalled();
  });

  it("should respond 500 with a database error message", async () => {
    MenuModel.findByStallId.mockRejectedValue(new Error("Database error occurred"));

    const req = mockRequest({ params: { stallId: "3" }, query: {} });
    const res = mockResponse();

    await MenuController.getMenuByStall(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Database error occurred",
      error: "Database error occurred"
    });
  });

  it("should pass any other failure to the error handler", async () => {
    const error = new Error("Unexpected failure");
    MenuModel.findByStallId.mockRejectedValue(error);

    const req = mockRequest({ params: { stallId: "3" }, query: {} });
    const res = mockResponse();
    const next = mockNext();

    await MenuController.getMenuByStall(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
