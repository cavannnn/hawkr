const dashboardController = require("../controllers/vendorDashboardController");
const Dashboard = require("../models/vendorDashboardModel");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/vendorDashboardModel");

describe("vendorDashboardController.getDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the dashboard for the vendor", async () => {
    const dashboard = { TotalRevenue: 1200, TotalOrders: 42, MonthlyGoal: 3000 };
    Dashboard.getDashboardByVendorId.mockResolvedValue(dashboard);

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await dashboardController.getDashboard(req, res);

    expect(Dashboard.getDashboardByVendorId).toHaveBeenCalledWith("5");
    expect(res.json).toHaveBeenCalledWith(dashboard);
  });

  it("should respond 500 when the lookup fails", async () => {
    Dashboard.getDashboardByVendorId.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await dashboardController.getDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("vendorDashboardController.updateDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should save the supplied metrics", async () => {
    Dashboard.updateDashboard.mockResolvedValue(true);

    const body = { totalRevenue: 500, totalOrders: 10, totalCustomers: 8 };
    const req = mockRequest({ params: { id: "5" }, body });
    const res = mockResponse();

    await dashboardController.updateDashboard(req, res);

    expect(Dashboard.updateDashboard).toHaveBeenCalledWith("5", body);
    expect(res.json).toHaveBeenCalledWith({ message: "Dashboard updated successfully" });
  });

  it("should respond 500 when the update fails", async () => {
    Dashboard.updateDashboard.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" }, body: {} });
    const res = mockResponse();

    await dashboardController.updateDashboard(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("vendorDashboardController.setGoal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should save a positive monthly goal", async () => {
    Dashboard.setMonthlyGoal.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "5" }, body: { monthlyGoal: "4000" } });
    const res = mockResponse();

    await dashboardController.setGoal(req, res);

    expect(Dashboard.setMonthlyGoal).toHaveBeenCalledWith("5", "4000");
    expect(res.json).toHaveBeenCalledWith({ message: "Monthly goal saved.", monthlyGoal: 4000 });
  });

  it("should respond 400 when the goal is zero", async () => {
    const req = mockRequest({ params: { id: "5" }, body: { monthlyGoal: 0 } });
    const res = mockResponse();

    await dashboardController.setGoal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "A monthly goal greater than 0 is required." });
    expect(Dashboard.setMonthlyGoal).not.toHaveBeenCalled();
  });

  it("should respond 400 when the goal is negative", async () => {
    const req = mockRequest({ params: { id: "5" }, body: { monthlyGoal: -10 } });
    const res = mockResponse();

    await dashboardController.setGoal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Dashboard.setMonthlyGoal).not.toHaveBeenCalled();
  });

  it("should respond 400 when the goal is missing", async () => {
    const req = mockRequest({ params: { id: "5" }, body: {} });
    const res = mockResponse();

    await dashboardController.setGoal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Dashboard.setMonthlyGoal).not.toHaveBeenCalled();
  });

  it("should respond 500 when saving fails", async () => {
    Dashboard.setMonthlyGoal.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" }, body: { monthlyGoal: 4000 } });
    const res = mockResponse();

    await dashboardController.setGoal(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});
