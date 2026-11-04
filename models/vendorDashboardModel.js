const sql = require("mssql");

const PAYMENT_METHOD_LABELS = { cash: "Cash", card: "Card", paynow: "PayNow", nets: "NETS" };
function formatPaymentMethod(method) {
  if (!method) return "Other";
  return PAYMENT_METHOD_LABELS[method.toLowerCase()] || method;
}

// dashboard numbers are from the vendor's real orders and menus.
// If the vendor has no orders yet everything will show 0 or an empty list.
async function getDashboardByVendorId(vendorId) {
  // Totals
  const totals = await sql.query`
    SELECT
      ISNULL(SUM(totalAmount), 0) AS TotalRevenue,
      COUNT(*) AS TotalOrders,
      COUNT(DISTINCT customerId) AS TotalCustomers
    FROM Orders
    WHERE vendorId = ${vendorId}
  `;

  // How many menu items this vendor has
  const menus = await sql.query`
    SELECT COUNT(*) AS TotalMenus FROM Menus WHERE vendorId = ${vendorId}
  `;

  // Sales for each month, oldest month first
  const trend = await sql.query`
    SELECT
      YEAR(orderDate) AS OrderYear,
      MONTH(orderDate) AS OrderMonth,
      SUM(totalAmount) AS Total
    FROM Orders
    WHERE vendorId = ${vendorId}
    GROUP BY YEAR(orderDate), MONTH(orderDate)
    ORDER BY OrderYear, OrderMonth
  `;

  // Revenue grouped by payment method (cancelled orders aren't real revenue, so
  // they're excluded here and that breakdown already belongs to the Fulfillment panel)
  const split = await sql.query`
    SELECT paymentMethod AS Label, SUM(totalAmount) AS Total
    FROM Orders
    WHERE vendorId = ${vendorId} AND status != 'cancelled'
    GROUP BY paymentMethod
  `;

  // The 5 newest orders
  const recent = await sql.query`
    SELECT TOP 5 orderId, orderDate, status, totalAmount
    FROM Orders
    WHERE vendorId = ${vendorId}
    ORDER BY orderDate DESC
  `;

  // Best sellers by quantity, across every stall this vendor runs
  const topItems = await sql.query`
    SELECT TOP 5 oi.itemName, SUM(oi.quantity) AS TotalQuantity
    FROM OrderItems oi
    JOIN Orders o ON o.orderId = oi.orderId
    WHERE o.vendorId = ${vendorId}
    GROUP BY oi.itemName
    ORDER BY TotalQuantity DESC
  `;

  // Fulfillment: completed orders vs cancelled ones, plus what's still in flight (pending/preparing/ready)
  const fulfillment = await sql.query`
    SELECT
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS Successful,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS Unsuccessful,
      SUM(CASE WHEN status IN ('pending', 'preparing', 'ready') THEN 1 ELSE 0 END) AS InProgress
    FROM Orders
    WHERE vendorId = ${vendorId}
  `;
  const successful = fulfillment.recordset[0].Successful || 0;
  const unsuccessful = fulfillment.recordset[0].Unsuccessful || 0;
  const inProgress = fulfillment.recordset[0].InProgress || 0;
  const resolvedCount = successful + unsuccessful;

  const monthlyGoal = await getMonthlyGoal(vendorId);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return {
    TotalRevenue: totals.recordset[0].TotalRevenue,
    TotalOrders: totals.recordset[0].TotalOrders,
    TotalCustomers: totals.recordset[0].TotalCustomers,
    TotalMenus: menus.recordset[0].TotalMenus,
    MonthlySalesTrend: trend.recordset.map(row => ({
      label: monthNames[row.OrderMonth - 1] + " " + row.OrderYear,
      value: row.Total
    })),
    RevenueSplit: split.recordset.map(row => ({
      label: formatPaymentMethod(row.Label),
      value: row.Total
    })),
    RecentOrders: recent.recordset,
    TopSellingItems: topItems.recordset.map(row => ({
      itemName: row.itemName,
      quantity: row.TotalQuantity
    })),
    Fulfillment: {
      successful,
      unsuccessful,
      inProgress,
      successRate: resolvedCount > 0 ? Math.round((successful / resolvedCount) * 100) : 0
    },
    MonthlyGoal: monthlyGoal
  };
}

async function getMonthlyGoal(vendorId) {
  const result = await sql.query`SELECT monthlyGoal FROM VendorDashboard WHERE vendorId = ${vendorId}`;
  if (result.recordset.length > 0) return Number(result.recordset[0].monthlyGoal);

  await sql.query`INSERT INTO VendorDashboard (vendorId, totalRevenue, totalOrders, totalCustomers) VALUES (${vendorId}, 0, 0, 0)`;
  const created = await sql.query`SELECT monthlyGoal FROM VendorDashboard WHERE vendorId = ${vendorId}`;
  return Number(created.recordset[0].monthlyGoal);
}

async function setMonthlyGoal(vendorId, goalAmount) {
  const existing = await sql.query`SELECT vendorId FROM VendorDashboard WHERE vendorId = ${vendorId}`;
  if (existing.recordset.length > 0) {
    await sql.query`UPDATE VendorDashboard SET monthlyGoal = ${goalAmount} WHERE vendorId = ${vendorId}`;
  } else {
    await sql.query`INSERT INTO VendorDashboard (vendorId, totalRevenue, totalOrders, totalCustomers, monthlyGoal) VALUES (${vendorId}, 0, 0, 0, ${goalAmount})`;
  }
}

// Save summary numbers into the VendorDashboard table.
async function updateDashboard(vendorId, data) {
  const request = new sql.Request();
  request.input("vendorId", sql.Int, vendorId);
  request.input("totalRevenue", sql.Decimal(18, 2), data.totalRevenue);
  request.input("totalOrders", sql.Int, data.totalOrders);
  request.input("totalCustomers", sql.Int, data.totalCustomers);
  request.input("monthlySalesTrend", sql.NVarChar, data.monthlySalesTrend);
  request.input("revenueSplit", sql.NVarChar, data.revenueSplit);
  request.input("topSellingItems", sql.NVarChar, data.topSellingItems);

  await request.query(`
    UPDATE VendorDashboard
    SET totalRevenue = @totalRevenue,
        totalOrders = @totalOrders,
        totalCustomers = @totalCustomers,
        monthlySalesTrend = @monthlySalesTrend,
        revenueSplit = @revenueSplit,
        topSellingItems = @topSellingItems,
        lastUpdated = GETDATE()
    WHERE vendorId = @vendorId
  `);

  return true;
}

module.exports = { getDashboardByVendorId, updateDashboard, getMonthlyGoal, setMonthlyGoal };
