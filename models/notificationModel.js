const sql = require("mssql");
const Stall = require("./stallModel");

const LOW_STOCK_THRESHOLD = 5;
const ENDING_SOON_DAYS = 3;

async function createNotification(vendorId, type, title, message, linkUrl, referenceType, referenceId) {
  const existing = await sql.query`
    SELECT notificationId FROM Notifications
    WHERE vendorId = ${vendorId} AND type = ${type}
      AND referenceType = ${referenceType} AND referenceId = ${referenceId}
  `;
  if (existing.recordset.length > 0) return false;

  await sql.query`
    INSERT INTO Notifications (vendorId, type, title, message, linkUrl, referenceType, referenceId)
    VALUES (${vendorId}, ${type}, ${title}, ${message}, ${linkUrl}, ${referenceType}, ${referenceId})
  `;
  return true;
}

async function getNotificationsForVendor(vendorId, limit) {
  const result = await sql.query`
    SELECT TOP (${limit || 30}) notificationId, type, title, message, linkUrl, isRead, createdAt
    FROM Notifications
    WHERE vendorId = ${vendorId}
    ORDER BY createdAt DESC
  `;
  return result.recordset;
}

async function getUnreadCount(vendorId) {
  const result = await sql.query`
    SELECT COUNT(*) AS cnt FROM Notifications WHERE vendorId = ${vendorId} AND isRead = 0
  `;
  return result.recordset[0].cnt;
}

async function deleteNotification(vendorId, notificationId) {
  const result = await sql.query`
    DELETE FROM Notifications WHERE notificationId = ${notificationId} AND vendorId = ${vendorId}
  `;
  return result.rowsAffected[0] > 0;
}

async function markAsRead(vendorId, notificationId) {
  const result = await sql.query`
    UPDATE Notifications SET isRead = 1 WHERE notificationId = ${notificationId} AND vendorId = ${vendorId}
  `;
  return result.rowsAffected[0] > 0;
}

async function markAllAsRead(vendorId) {
  await sql.query`UPDATE Notifications SET isRead = 1 WHERE vendorId = ${vendorId} AND isRead = 0`;
  return true;
}

// ---------- Condition checks that generate notifications ----------

async function checkTargetHit(vendorId, stall) {
  const target = await Stall.getMonthlyTarget(stall.stallId);
  if (target.targetId && target.progressPercent >= 100) {
    await createNotification(
      vendorId, "target",
      "Monthly target hit! 🎯",
      `${stall.stallName} reached its ${target.targetType} target for this month.`,
      `storeDetail.html?stallId=${stall.stallId}`,
      "target", target.targetId
    );
  }
}

async function checkLowStock(vendorId, stall) {
  const stock = await Stall.getStallStock(stall.stallId);
  for (const item of stock) {
    if (item.inStock && Number(item.quantity) <= LOW_STOCK_THRESHOLD) {
      await createNotification(
        vendorId, "low_stock",
        "Low stock: " + item.itemName,
        `${stall.stallName} is running low on ${item.itemName} (${item.quantity}${item.unit ? " " + item.unit : ""} left).`,
        `storeStock.html?stallId=${stall.stallId}`,
        "stockItem", item.stockItemId
      );
    }
  }
}

// Date-window checks run in SQL (not JS `Date` math) so "today" is always the
// database server's calendar day, regardless of the app server's local timezone.
async function checkPromotionsEnding(vendorId, stall) {
  const result = await sql.query`
    SELECT promotionId, name, endDate
    FROM Promotions
    WHERE stallId = ${stall.stallId} AND isActive = 1
      AND CAST(endDate AS DATE) >= CAST(GETDATE() AS DATE)
      AND CAST(endDate AS DATE) <= CAST(DATEADD(DAY, ${ENDING_SOON_DAYS}, GETDATE()) AS DATE)
  `;

  for (const promo of result.recordset) {
    await createNotification(
      vendorId, "promotion_ending",
      "Promotion ending soon",
      `"${promo.name}" at ${stall.stallName} ends on ${new Date(promo.endDate).toLocaleDateString()}.`,
      `storePromotions.html?stallId=${stall.stallId}`,
      "promotion", promo.promotionId
    );
  }
}

async function checkVouchersEnding(vendorId, stall) {
  const expired = await sql.query`
    SELECT voucherId, code FROM Vouchers
    WHERE stallId = ${stall.stallId} AND isActive = 1
      AND CAST(endDate AS DATE) < CAST(GETDATE() AS DATE)
  `;
  for (const voucher of expired.recordset) {
    await createNotification(
      vendorId, "voucher_expired",
      "Voucher expired",
      `"${voucher.code}" at ${stall.stallName} has expired.`,
      `storePromotions.html?stallId=${stall.stallId}`,
      "voucher", voucher.voucherId
    );
  }

  const endingSoon = await sql.query`
    SELECT voucherId, code, endDate FROM Vouchers
    WHERE stallId = ${stall.stallId} AND isActive = 1
      AND CAST(endDate AS DATE) >= CAST(GETDATE() AS DATE)
      AND CAST(endDate AS DATE) <= CAST(DATEADD(DAY, ${ENDING_SOON_DAYS}, GETDATE()) AS DATE)
  `;
  for (const voucher of endingSoon.recordset) {
    await createNotification(
      vendorId, "voucher_expiring",
      "Voucher expiring soon",
      `"${voucher.code}" at ${stall.stallName} expires on ${new Date(voucher.endDate).toLocaleDateString()}.`,
      `storePromotions.html?stallId=${stall.stallId}`,
      "voucher", voucher.voucherId
    );
  }
}

const RENTAL_RENEWAL_DAYS = 30;

// Renewal due within 30 days, or already past end date and still unrenewed
async function checkRentalRenewal(vendorId, stall) {
  const result = await sql.query`
    SELECT AgreementId, AgreementEndDate FROM RentalAgreements
    WHERE StallId = ${stall.stallId}
      AND CAST(AgreementEndDate AS DATE) <= CAST(DATEADD(DAY, ${RENTAL_RENEWAL_DAYS}, GETDATE()) AS DATE)
  `;

  for (const agreement of result.recordset) {
    const overdue = new Date(agreement.AgreementEndDate) < new Date();
    await createNotification(
      vendorId, overdue ? "rental_overdue" : "rental_renewal",
      overdue ? "Rental agreement overdue for renewal" : "Rental agreement renewal due soon",
      `${stall.stallName}'s lease ${overdue ? "ended" : "ends"} on ${new Date(agreement.AgreementEndDate).toLocaleDateString()}. Contact your operator to renew.`,
      `storeRental.html?stallId=${stall.stallId}`,
      "rentalAgreement", agreement.AgreementId
    );
  }
}

async function createInspectionNotification(vendorId, stallId, type, title, message, inspectionId, inspectionDate) {
  const referenceType = inspectionId ? "inspection" : null;
  await sql.query`
    INSERT INTO Notifications
      (vendorId, stallId, type, title, message, linkUrl, referenceType, referenceId, inspectionDate)
    VALUES
      (${vendorId}, ${stallId}, ${type}, ${title}, ${message}, ${null}, ${referenceType}, ${inspectionId || null}, ${inspectionDate || null})
  `;
}

async function getVendorIdForStall(stallId) {
  const result = await sql.query`SELECT vendorId FROM Stalls WHERE stallId = ${stallId}`;
  return result.recordset[0]?.vendorId ?? null;
}

async function notifyInspectionCreated(stallId, inspectionId, inspectionDate) {
  const vendorId = await getVendorIdForStall(stallId);
  if (!vendorId) return;

  await createInspectionNotification(
    vendorId, stallId, "inspection_created", "Inspection scheduled",
    `A new inspection has been scheduled for your stall on ${inspectionDate}.`,
    inspectionId, inspectionDate
  );
}

async function notifyInspectionUpdated(stallId, inspectionId, inspectionDate) {
  const vendorId = await getVendorIdForStall(stallId);
  if (!vendorId) return;

  await createInspectionNotification(
    vendorId, stallId, "inspection_updated", "Inspection rescheduled",
    `Your scheduled inspection has been moved to ${inspectionDate}.`,
    inspectionId, inspectionDate
  );
}

async function notifyInspectionCancelled(stallId, inspectionDate) {
  const vendorId = await getVendorIdForStall(stallId);
  if (!vendorId) return;

  await createInspectionNotification(
    vendorId, stallId, "inspection_cancelled", "Inspection cancelled",
    `Your scheduled inspection on ${inspectionDate} has been cancelled.`,
    null, inspectionDate
  );
}

function assessmentMessage(grade, remarks, isMajorIssue) {
  let message = `Your stall was assessed and is now Grade ${grade}.`;
  if (isMajorIssue) message += " A major issue was recorded, which places the stall on probation.";
  const note = String(remarks || "").trim();
  if (note) message += ` Officer's remarks: ${note}`;
  return message;
}

async function notifyAssessmentCompleted(stallId, inspectionId, inspectionDate, grade, remarks, isMajorIssue) {
  const vendorId = await getVendorIdForStall(stallId);
  if (!vendorId) return;

  await createInspectionNotification(
    vendorId, stallId, "assessment_completed", `Inspection complete — Grade ${grade}`,
    assessmentMessage(grade, remarks, isMajorIssue),
    inspectionId, inspectionDate
  );
}

async function notifyAssessmentUpdated(stallId, inspectionId, inspectionDate, grade, remarks, isMajorIssue) {
  const vendorId = await getVendorIdForStall(stallId);
  if (!vendorId) return;

  await createInspectionNotification(
    vendorId, stallId, "assessment_updated", `Assessment revised — Grade ${grade}`,
    assessmentMessage(grade, remarks, isMajorIssue).replace("was assessed and is now", "assessment was revised and is now"),
    inspectionId, inspectionDate
  );
}

async function checkInspectionsToday(vendorId, stall) {
  const result = await sql.query`
    SELECT i.inspectionId, i.inspectionDate
    FROM Inspections i
    WHERE i.stallId = ${stall.stallId}
      AND i.status IN ('Scheduled', 'In Progress')
      AND CAST(i.inspectionDate AS DATE) = CAST(GETDATE() AS DATE)
      AND NOT EXISTS (
        SELECT 1 FROM Notifications n
        WHERE n.referenceType = 'inspection'
          AND n.referenceId = i.inspectionId
          AND n.type = 'inspection_reminder'
          AND CAST(n.createdAt AS DATE) = CAST(GETDATE() AS DATE)
      )
  `;

  for (const inspection of result.recordset) {
    const date = new Date(inspection.inspectionDate).toLocaleDateString();
    await createInspectionNotification(
      vendorId, stall.stallId, "inspection_reminder", "Inspection today",
      `Your stall inspection is scheduled for today (${date}).`,
      inspection.inspectionId, inspection.inspectionDate
    );
  }
}

// Scans every stall this vendor owns for target/stock/promotion/voucher/rental conditions.
// New-order notifications are created directly at order-creation time instead (see orderModel.create).
async function generateNotifications(vendorId) {
  const stallsResult = await sql.query`SELECT stallId, stallName FROM Stalls WHERE vendorId = ${vendorId}`;

  for (const stall of stallsResult.recordset) {
    await checkTargetHit(vendorId, stall);
    await checkLowStock(vendorId, stall);
    await checkPromotionsEnding(vendorId, stall);
    await checkVouchersEnding(vendorId, stall);
    await checkRentalRenewal(vendorId, stall);
    await checkInspectionsToday(vendorId, stall);
  }
}

module.exports = {
  createNotification,
  getNotificationsForVendor,
  getUnreadCount,
  deleteNotification,
  markAsRead,
  markAllAsRead,
  generateNotifications,
  notifyInspectionCreated,
  notifyInspectionUpdated,
  notifyInspectionCancelled,
  notifyAssessmentCompleted,
  notifyAssessmentUpdated
};
