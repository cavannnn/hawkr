const sql = require("mssql");
const { generateMenuForStall } = require("./menuTemplates");
const { generateRentalAgreementText } = require("./rentalAgreementTemplates");
const { performanceStartDateForGrade, pendingGradeFor } = require("../utils/grading");

function withPendingGrade(row) {
  if (!row) return row;
  return Object.assign({}, row, { pendingGrade: pendingGradeFor(row) });
}

// List of hawker centres for the request form
async function getCentres() {
  const result = await sql.query`
    SELECT centreId, centreName, address, postalCode
    FROM HawkerCentres
    ORDER BY centreName
  `;
  return result.recordset;
}

// The stalls a vendor already owns (created after an operator approves a request)
async function getStallsByVendor(vendorId) {
  const result = await sql.query`
    SELECT s.stallId, s.stallName, s.unitNumber, s.operatingHours, s.imageUrl,
           s.currentGrade AS neaGrade, s.performanceStartDate,
           c.centreName, c.address
    FROM Stalls s
    JOIN HawkerCentres c ON c.centreId = s.centreId
    WHERE s.vendorId = ${vendorId}
    ORDER BY s.stallName
  `;
  return result.recordset.map(withPendingGrade);
}

// Every request this vendor has sent
async function getRequestsByVendor(vendorId) {
  const result = await sql.query`
    SELECT r.requestId, r.stallName, r.unitNumber, r.description, r.status,
           r.operatingHours, r.hygieneGrade, r.imageUrl,
           r.reviewNote, r.requestedAt, c.centreName
    FROM StallRequests r
    JOIN HawkerCentres c ON c.centreId = r.centreId
    WHERE r.vendorId = ${vendorId}
    ORDER BY r.requestedAt DESC
  `;
  return result.recordset;
}

// Vendor sends a new request
async function createRequest(vendorId, data) {
  const result = await sql.query`
    INSERT INTO StallRequests
      (vendorId, centreId, stallName, unitNumber, description, operatingHours, hygieneGrade, imageUrl)
    VALUES
      (${vendorId}, ${data.centreId}, ${data.stallName}, ${data.unitNumber}, ${data.description},
       ${data.operatingHours}, ${data.hygieneGrade}, ${data.imageUrl})
  `;
  return result.rowsAffected[0] > 0;
}

// Requests still waiting for an operator to decide
async function getPendingRequests() {
  const result = await sql.query`
    SELECT r.requestId, r.vendorId, r.stallName, r.unitNumber, r.description,
           r.operatingHours, r.hygieneGrade, r.imageUrl,
           r.requestedAt, c.centreName, u.username
    FROM StallRequests r
    JOIN HawkerCentres c ON c.centreId = r.centreId
    JOIN UserAccounts u ON u.userId = r.vendorId
    WHERE r.status = 'pending'
    ORDER BY r.requestedAt
  `;
  return result.recordset;
}

async function getRequestById(requestId) {
  const result = await sql.query`
    SELECT * FROM StallRequests WHERE requestId = ${requestId}
  `;
  return result.recordset[0];
}

// Once the Operator says yes, create the stall, mark the request approved, and
// generate a 6-month rental agreement starting today at the operator-set rate.
async function approveRequest(requestId, operatorId, rentalPrice) {
  const request = await getRequestById(requestId);
  if (!request) return "not found";
  if (request.status !== "pending") return "already reviewed";

  // The same unit number cannot be used twice in one hawker centre
  const taken = await sql.query`
    SELECT stallId FROM Stalls
    WHERE centreId = ${request.centreId} AND unitNumber = ${request.unitNumber}
  `;
  if (taken.recordset.length > 0) return "unit taken";

  const performanceStartDate = performanceStartDateForGrade(request.hygieneGrade);

  const inserted = await sql.query`
    INSERT INTO Stalls
      (centreId, vendorId, stallName, unitNumber, operatingHours, imageUrl, performanceStartDate)
    VALUES
      (${request.centreId}, ${request.vendorId}, ${request.stallName}, ${request.unitNumber},
       ${request.operatingHours}, ${request.imageUrl}, ${performanceStartDate});
    SELECT SCOPE_IDENTITY() AS stallId;
  `;
  const newStallId = inserted.recordset[0].stallId;

  await sql.query`
    UPDATE StallRequests
    SET status = 'approved', reviewedAt = GETDATE()
    WHERE requestId = ${requestId}
  `;

  // Give the new stall a starter menu so it isn't empty on day one
  const starterItems = generateMenuForStall(request.stallName, request.description);
  for (const item of starterItems) {
    await sql.query`
      INSERT INTO Menus (vendorId, stallId, itemName, price, category, description, available)
      VALUES (${request.vendorId}, ${newStallId}, ${item.itemName}, ${item.price}, ${item.category}, ${item.description}, 1)
    `;
  }

  // Auto-generate the rental agreement: starts the moment the operator approves,
  // runs for six months, at the rate the operator just set.
  const centreResult = await sql.query`SELECT centreName FROM HawkerCentres WHERE centreId = ${request.centreId}`;
  const ownerResult = await sql.query`SELECT username FROM UserAccounts WHERE userId = ${operatorId}`;
  const renterResult = await sql.query`SELECT username FROM UserAccounts WHERE userId = ${request.vendorId}`;

  const agreementText = generateRentalAgreementText({
    ownerName: ownerResult.recordset[0] ? ownerResult.recordset[0].username : "Hawker Centre Management",
    renterName: renterResult.recordset[0] ? renterResult.recordset[0].username : request.stallName,
    centreName: centreResult.recordset[0] ? centreResult.recordset[0].centreName : "",
    unitNumber: request.unitNumber,
    purposeOfUse: request.description,
    rentalPrice,
    startDate: new Date(),
    endDate: new Date(new Date().setMonth(new Date().getMonth() + 6))
  });

  const operatorName = ownerResult.recordset[0] ? ownerResult.recordset[0].username : null;

  await sql.query`
    INSERT INTO RentalAgreements
      (StallId, OwnerId, AgreementStartDate, AgreementEndDate, AgreementTermsAndConditions, RentalPrice, ContractType, ContractName)
    VALUES
      (${newStallId}, ${operatorId}, SYSUTCDATETIME(), DATEADD(MONTH, 6, SYSUTCDATETIME()), ${agreementText}, ${rentalPrice}, 'Fixed Price', ${operatorName})
  `;

  return "ok";
}

// If Operator says no, with a reason
async function rejectRequest(requestId, reviewNote) {
  const request = await getRequestById(requestId);
  if (!request) return "not found";
  if (request.status !== "pending") return "already reviewed";

  await sql.query`
    UPDATE StallRequests
    SET status = 'rejected', reviewNote = ${reviewNote}, reviewedAt = GETDATE()
    WHERE requestId = ${requestId}
  `;

  return "ok";
}

// One stall's own detail page, only returns it if this vendor actually owns it
async function getStallForVendor(vendorId, stallId) {
  const result = await sql.query`
    SELECT s.stallId, s.stallName, s.unitNumber, s.operatingHours, s.imageUrl,
           s.currentGrade AS neaGrade, s.performanceStartDate,
           c.centreName, c.address,
           u.username AS ownerName, u.email AS ownerEmail
    FROM Stalls s
    JOIN HawkerCentres c ON c.centreId = s.centreId
    JOIN UserAccounts u ON u.userId = s.vendorId
    WHERE s.stallId = ${stallId} AND s.vendorId = ${vendorId}
  `;
  return withPendingGrade(result.recordset[0]);
}

// Lifetime, and this-calendar-month order totals for one stall
async function getStallStats(stallId) {
  const result = await sql.query`
    SELECT
      COUNT(*) AS totalOrders,
      ISNULL(SUM(totalAmount), 0) AS totalRevenue,
      ISNULL(SUM(CASE
        WHEN MONTH(orderDate) = MONTH(GETDATE()) AND YEAR(orderDate) = YEAR(GETDATE())
        THEN totalAmount ELSE 0
      END), 0) AS thisMonthSales
    FROM Orders
    WHERE stallId = ${stallId}
  `;
  return result.recordset[0];
}

// Top 5 items by quantity sold, for this stall's orders
async function getTopSellingItems(stallId) {
  const result = await sql.query`
    SELECT TOP 5 oi.itemName, SUM(oi.quantity) AS totalQuantity
    FROM OrderItems oi
    JOIN Orders o ON o.orderId = oi.orderId
    WHERE o.stallId = ${stallId}
    GROUP BY oi.itemName
    ORDER BY totalQuantity DESC
  `;
  return result.recordset;
}

// A stall's own menu items (for the Store Menus page)
async function getStallMenu(stallId) {
  const result = await sql.query`
    SELECT menuId, itemName, price, category, description, available
    FROM Menus
    WHERE stallId = ${stallId}
    ORDER BY menuId
  `;
  return result.recordset;
}

async function addMenuItem(vendorId, stallId, data) {
  const result = await sql.query`
    INSERT INTO Menus (vendorId, stallId, itemName, price, category, description, available)
    VALUES (${vendorId}, ${stallId}, ${data.itemName}, ${data.price}, ${data.category || null}, ${data.description || null}, 1)
  `;
  return result.rowsAffected[0] > 0;
}

async function updateMenuItem(stallId, menuId, data) {
  const result = await sql.query`
    UPDATE Menus
    SET itemName = ${data.itemName}, price = ${data.price}, category = ${data.category || null},
        description = ${data.description || null}, available = ${data.available ? 1 : 0}
    WHERE menuId = ${menuId} AND stallId = ${stallId}
  `;
  return result.rowsAffected[0] > 0;
}

async function deleteMenuItem(stallId, menuId) {
  const result = await sql.query`
    DELETE FROM Menus WHERE menuId = ${menuId} AND stallId = ${stallId}
  `;
  return result.rowsAffected[0] > 0;
}

// A vendor permanently deleting their own store — deletes every row anywhere in the
// database that references this stall, including real order/review/rental history.
async function deleteStall(vendorId, stallId) {
  const owned = await sql.query`
    SELECT stallId FROM Stalls WHERE stallId = ${stallId} AND vendorId = ${vendorId}
  `;
  if (owned.recordset.length === 0) return "not found";

  const tx = new sql.Transaction();
  await tx.begin();

  try {
    const run = (query) => new sql.Request(tx).input("StallId", sql.Int, stallId).query(query);

    // Deleting from deepest leaves first
    await run(`DELETE FROM GradeHistory WHERE stallId = @StallId`);
    await run(`DELETE FROM OrderItems WHERE orderId IN (SELECT orderId FROM Orders WHERE stallId = @StallId)`);
    await run(`
      DELETE FROM VoucherRedemptions
      WHERE orderId IN (SELECT orderId FROM Orders WHERE stallId = @StallId)
         OR voucherId IN (SELECT voucherId FROM Vouchers WHERE stallId = @StallId)
    `);
    await run(`DELETE FROM StallReviews WHERE stallId = @StallId`);
    await run(`DELETE FROM PromotionApprovalQueue WHERE StallPromotionId IN (SELECT promotionId FROM Promotions WHERE stallId = @StallId)`);
    await run(`
      DELETE FROM PromotionItems
      WHERE promotionId IN (SELECT promotionId FROM Promotions WHERE stallId = @StallId)
         OR menuId IN (SELECT menuId FROM Menus WHERE stallId = @StallId)
    `);
    await run(`DELETE FROM CentrePromotionStall WHERE StallId = @StallId`);
    await run(`DELETE FROM Favorites WHERE stallId = @StallId`);
    await run(`DELETE FROM Orders WHERE stallId = @StallId`);
    await run(`DELETE FROM Inspections WHERE stallId = @StallId`);
    await run(`DELETE FROM Promotions WHERE stallId = @StallId`);
    await run(`DELETE FROM RentalRenewalRequests WHERE StallId = @StallId`);
    await run(`DELETE FROM RentalAgreements WHERE StallId = @StallId`);
    await run(`DELETE FROM Vouchers WHERE stallId = @StallId`);
    await run(`DELETE FROM Menus WHERE stallId = @StallId`);
    await run(`DELETE FROM StockItems WHERE stallId = @StallId`);
    await run(`DELETE FROM MonthlyTargets WHERE stallId = @StallId`);
    await run(`DELETE FROM Stalls WHERE stallId = @StallId`);

    await tx.commit();
    return "ok";
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------- Track Inventory (stock items) ----------
// Same shape as the Menu feature, just tracking stock instead of food items

async function getStallStock(stallId) {
  const result = await sql.query`
    SELECT stockItemId, itemName, quantity, unit, category, description, inStock
    FROM StockItems
    WHERE stallId = ${stallId}
    ORDER BY stockItemId
  `;
  return result.recordset;
}

async function addStockItem(vendorId, stallId, data) {
  const result = await sql.query`
    INSERT INTO StockItems (vendorId, stallId, itemName, quantity, unit, category, description, inStock)
    VALUES (${vendorId}, ${stallId}, ${data.itemName}, ${data.quantity}, ${data.unit || null}, ${data.category || null}, ${data.description || null}, 1)
  `;
  return result.rowsAffected[0] > 0;
}

async function updateStockItem(stallId, stockItemId, data) {
  const result = await sql.query`
    UPDATE StockItems
    SET itemName = ${data.itemName}, quantity = ${data.quantity}, unit = ${data.unit || null},
        category = ${data.category || null}, description = ${data.description || null}, inStock = ${data.inStock ? 1 : 0}
    WHERE stockItemId = ${stockItemId} AND stallId = ${stallId}
  `;
  return result.rowsAffected[0] > 0;
}

async function deleteStockItem(stallId, stockItemId) {
  const result = await sql.query`
    DELETE FROM StockItems WHERE stockItemId = ${stockItemId} AND stallId = ${stallId}
  `;
  return result.rowsAffected[0] > 0;
}

/* ---------- Monthly Target ---------- */

async function getMonthlyTarget(stallId) {
  const targetResult = await sql.query`
    SELECT TOP 1 targetId, targetType, targetValue
    FROM MonthlyTargets
    WHERE stallId = ${stallId} AND targetMonth = MONTH(GETDATE()) AND targetYear = YEAR(GETDATE())
  `;
  const target = targetResult.recordset[0];

  if (!target) {
    return { targetId: null, targetType: null, targetValue: null, progressValue: 0, progressPercent: 0 };
  }

  const progressResult = await sql.query`
    SELECT
      ISNULL(SUM(o.totalAmount), 0) AS revenue,
      COUNT(*) AS orders,
      COUNT(DISTINCT COALESCE(o.customerPhone, o.customerName)) AS customers,
      ISNULL((
        SELECT SUM(oi.quantity)
        FROM OrderItems oi
        WHERE oi.orderId IN (
          SELECT orderId FROM Orders
          WHERE stallId = ${stallId}
            AND orderDate >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
            AND orderDate < DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
        )
      ), 0) AS items
    FROM Orders o
    WHERE o.stallId = ${stallId}
      AND o.orderDate >= DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)
      AND o.orderDate < DATEADD(MONTH, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))
  `;
  const { revenue, orders, customers, items } = progressResult.recordset[0];
  const progressByType = { revenue, orders, customers, items };
  const progressValue = progressByType[target.targetType] ?? 0;
  const progressPercent = target.targetValue > 0
    ? Math.min(100, Math.round((progressValue / target.targetValue) * 100))
    : 0;

  return { ...target, progressValue, progressPercent };
}

// Upsert this calendar month's target for a stall
async function setMonthlyTarget(vendorId, stallId, data) {
  await sql.query`
    IF EXISTS (
      SELECT 1 FROM MonthlyTargets
      WHERE stallId = ${stallId} AND targetMonth = MONTH(GETDATE()) AND targetYear = YEAR(GETDATE())
    )
      UPDATE MonthlyTargets
      SET targetType = ${data.targetType}, targetValue = ${data.targetValue}, updatedAt = GETDATE()
      WHERE stallId = ${stallId} AND targetMonth = MONTH(GETDATE()) AND targetYear = YEAR(GETDATE())
    ELSE
      INSERT INTO MonthlyTargets (vendorId, stallId, targetType, targetValue, targetMonth, targetYear)
      VALUES (${vendorId}, ${stallId}, ${data.targetType}, ${data.targetValue}, MONTH(GETDATE()), YEAR(GETDATE()))
  `;
  return true;
}

async function getStallsByOperator(operatorId) {
  const result = await sql.query`
    SELECT DISTINCT s.stallId, s.stallName, s.unitNumber, s.operatingHours, s.imageUrl,
           s.cuisineType,
           s.currentGrade AS neaGrade, s.performanceStartDate,
           c.centreName, c.address,
           u.username AS vendorName
    FROM Stalls s
    JOIN RentalAgreements ra ON ra.StallId = s.stallId
    JOIN HawkerCentres c ON c.centreId = s.centreId
    JOIN UserAccounts u ON u.userId = s.vendorId
    WHERE ra.OwnerId = ${operatorId}
    ORDER BY s.stallName
  `;
  return result.recordset.map(withPendingGrade);
}

async function getStallForOperator(operatorId, stallId) {
  const agreementResult = await sql.query`
    SELECT TOP 1 RentalPrice, AgreementStartDate, AgreementEndDate, ContractType
    FROM RentalAgreements
    WHERE StallId = ${stallId} AND OwnerId = ${operatorId}
    ORDER BY AgreementStartDate DESC
  `;
  if (agreementResult.recordset.length === 0) return null;

  const stallResult = await sql.query`
    SELECT s.stallId, s.stallName, s.unitNumber, s.operatingHours, s.imageUrl,
           s.cuisineType,
           s.currentGrade AS neaGrade, s.performanceStartDate,
           c.centreName, c.address,
           u.username AS vendorName, u.email AS vendorEmail
    FROM Stalls s
    JOIN HawkerCentres c ON c.centreId = s.centreId
    JOIN UserAccounts u ON u.userId = s.vendorId
    WHERE s.stallId = ${stallId}
  `;
  if (stallResult.recordset.length === 0) return null;

  return { ...withPendingGrade(stallResult.recordset[0]), agreement: agreementResult.recordset[0] };
}

module.exports = {
  getCentres,
  getStallsByVendor,
  getRequestsByVendor,
  createRequest,
  getPendingRequests,
  approveRequest,
  rejectRequest,
  getStallForVendor,
  getStallStats,
  getTopSellingItems,
  getStallMenu,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  deleteStall,
  getStallStock,
  addStockItem,
  updateStockItem,
  deleteStockItem,
  getMonthlyTarget,
  setMonthlyTarget,
  getStallsByOperator,
  getStallForOperator
};
