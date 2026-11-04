const Dashboard = require("../models/vendorDashboardModel");
const sql = require("mssql");
const { mockTaggedQuery, rows } = require("./helpers/dbMock");

jest.mock("mssql");

beforeEach(() => {
  jest.clearAllMocks();
});

function dashboardQueryResults(overrides) {
  const defaults = {
    totals: rows([{ TotalRevenue: 1200, TotalOrders: 42, TotalCustomers: 18 }]),
    menus: rows([{ TotalMenus: 9 }]),
    trend: rows([{ OrderYear: 2026, OrderMonth: 2, Total: 500 }]),
    split: rows([{ Label: "paynow", Total: 700 }, { Label: null, Total: 100 }]),
    recent: rows([{ orderId: 12 }]),
    topItems: rows([{ itemName: "Chicken Rice", TotalQuantity: 30 }]),
    fulfillment: rows([{ Successful: 30, Unsuccessful: 10, InProgress: 2 }]),
    goal: rows([{ monthlyGoal: 3000 }])
  };
  const merged = Object.assign(defaults, overrides);
  return [
    merged.totals,
    merged.menus,
    merged.trend,
    merged.split,
    merged.recent,
    merged.topItems,
    merged.fulfillment,
    merged.goal
  ];
}

describe("vendorDashboardModel.getDashboardByVendorId", () => {
  it("should assemble every dashboard panel from the vendor's orders", async () => {
    mockTaggedQuery(dashboardQueryResults());

    const dashboard = await Dashboard.getDashboardByVendorId(5);

    expect(dashboard.TotalRevenue).toBe(1200);
    expect(dashboard.TotalOrders).toBe(42);
    expect(dashboard.TotalMenus).toBe(9);
    expect(dashboard.MonthlySalesTrend).toEqual([{ label: "Feb 2026", value: 500 }]);
    expect(dashboard.TopSellingItems).toEqual([{ itemName: "Chicken Rice", quantity: 30 }]);
    expect(dashboard.MonthlyGoal).toBe(3000);
  });

  it("should give each payment method a display label", async () => {
    mockTaggedQuery(dashboardQueryResults());

    const dashboard = await Dashboard.getDashboardByVendorId(5);

    expect(dashboard.RevenueSplit).toEqual([
      { label: "PayNow", value: 700 },
      { label: "Other", value: 100 }
    ]);
  });

  it("should work out the fulfillment success rate from resolved orders only", async () => {
    mockTaggedQuery(dashboardQueryResults());

    const dashboard = await Dashboard.getDashboardByVendorId(5);

    expect(dashboard.Fulfillment).toEqual({
      successful: 30,
      unsuccessful: 10,
      inProgress: 2,
      successRate: 75
    });
  });

  it("should report a zero success rate when nothing has resolved", async () => {
    mockTaggedQuery(
      dashboardQueryResults({
        fulfillment: rows([{ Successful: null, Unsuccessful: null, InProgress: 3 }])
      })
    );

    const dashboard = await Dashboard.getDashboardByVendorId(5);

    expect(dashboard.Fulfillment.successRate).toBe(0);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database Error"));

    await expect(Dashboard.getDashboardByVendorId(5)).rejects.toThrow("Database Error");
  });
});

describe("vendorDashboardModel.getMonthlyGoal", () => {
  it("should return the stored goal", async () => {
    mockTaggedQuery(rows([{ monthlyGoal: 3000 }]));

    await expect(Dashboard.getMonthlyGoal(5)).resolves.toBe(3000);
  });

  it("should create the dashboard row when the vendor has none yet", async () => {
    mockTaggedQuery([rows([]), rows([]), rows([{ monthlyGoal: 0 }])]);

    await expect(Dashboard.getMonthlyGoal(5)).resolves.toBe(0);
    expect(sql.query).toHaveBeenCalledTimes(3);
  });
});

describe("vendorDashboardModel.setMonthlyGoal", () => {
  it("should update the goal when a dashboard row exists", async () => {
    mockTaggedQuery([rows([{ vendorId: 5 }]), rows([])]);

    await Dashboard.setMonthlyGoal(5, 4000);

    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("should insert a dashboard row when the vendor has none", async () => {
    mockTaggedQuery([rows([]), rows([])]);

    await Dashboard.setMonthlyGoal(5, 4000);

    expect(sql.query).toHaveBeenCalledTimes(2);
  });
});

describe("vendorDashboardModel.updateDashboard", () => {
  function stubRequest(result) {
    const request = {
      input: jest.fn(function () {
        return request;
      }),
      query: jest.fn().mockImplementation(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
      )
    };
    sql.Request.mockImplementation(() => request);
    return request;
  }

  it("should save the summary numbers", async () => {
    const request = stubRequest(rows([]));

    const saved = await Dashboard.updateDashboard(5, {
      totalRevenue: 1200,
      totalOrders: 42,
      totalCustomers: 18,
      monthlySalesTrend: "[]",
      revenueSplit: "[]",
      topSellingItems: "[]"
    });

    expect(request.input).toHaveBeenCalledWith("vendorId", sql.Int, 5);
    expect(saved).toBe(true);
  });

  it("should propagate a database error", async () => {
    stubRequest(new Error("Database Error"));

    await expect(Dashboard.updateDashboard(5, {})).rejects.toThrow("Database Error");
  });
});
