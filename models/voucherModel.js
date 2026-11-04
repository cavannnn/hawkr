const sql = require("mssql");

// ---------- Vendor CRUD (Add Promotion page, Vouchers tab) ----------

async function getVouchersByStall(stallId) {
  const result = await sql.query`
    SELECT voucherId, code, description, discountType, discountValue,
           minOrderAmount, usageLimit, usageCount, isActive, startDate, endDate
    FROM Vouchers
    WHERE stallId = ${stallId}
    ORDER BY startDate DESC
  `;
  return result.recordset;
}

async function addVoucher(vendorId, stallId, data) {
  const existing = await sql.query`
    SELECT voucherId FROM Vouchers WHERE stallId = ${stallId} AND code = ${data.code}
  `;
  if (existing.recordset.length > 0) return "duplicate code";

  await sql.query`
    INSERT INTO Vouchers
      (vendorId, stallId, code, description, discountType, discountValue,
       minOrderAmount, usageLimit, isActive, startDate, endDate)
    VALUES
      (${vendorId}, ${stallId}, ${data.code}, ${data.description || null}, ${data.discountType}, ${data.discountValue},
       ${data.minOrderAmount || null}, ${data.usageLimit || null}, ${data.isActive ? 1 : 0},
       ${data.startDate}, ${data.endDate})
  `;
  return "ok";
}

async function updateVoucher(stallId, voucherId, data) {
  const existing = await sql.query`
    SELECT voucherId FROM Vouchers WHERE stallId = ${stallId} AND code = ${data.code} AND voucherId != ${voucherId}
  `;
  if (existing.recordset.length > 0) return "duplicate code";

  const result = await sql.query`
    UPDATE Vouchers
    SET code = ${data.code}, description = ${data.description || null},
        discountType = ${data.discountType}, discountValue = ${data.discountValue},
        minOrderAmount = ${data.minOrderAmount || null}, usageLimit = ${data.usageLimit || null},
        isActive = ${data.isActive ? 1 : 0}, startDate = ${data.startDate}, endDate = ${data.endDate}
    WHERE voucherId = ${voucherId} AND stallId = ${stallId}
  `;
  return result.rowsAffected[0] > 0 ? "ok" : "not found";
}

async function deleteVoucher(stallId, voucherId) {
  const owned = await sql.query`
    SELECT voucherId FROM Vouchers WHERE voucherId = ${voucherId} AND stallId = ${stallId}
  `;
  if (owned.recordset.length === 0) return false;

  // Past orders keep their history; they just lose the voucher reference.
  await sql.query`DELETE FROM VoucherRedemptions WHERE voucherId = ${voucherId}`;
  await sql.query`UPDATE Orders SET voucherId = NULL WHERE voucherId = ${voucherId}`;

  const result = await sql.query`
    DELETE FROM Vouchers WHERE voucherId = ${voucherId} AND stallId = ${stallId}
  `;
  return result.rowsAffected[0] > 0;
}

// ---------- Customer-facing validate + redeem ----------

async function validateVoucher(code, stallId, orderAmount) {
  if (!code) return { valid: false, message: "Enter a voucher code." };

  const result = await sql.query`
    SELECT voucherId, code, discountType, discountValue, minOrderAmount, usageLimit, usageCount, isActive,
           startDate, endDate, CAST(GETDATE() AS DATE) AS today
    FROM Vouchers
    WHERE stallId = ${stallId} AND code = ${code.trim().toUpperCase()}
  `;
  const voucher = result.recordset[0];

  if (!voucher) return { valid: false, message: "This voucher code doesn't exist for this stall." };
  if (!voucher.isActive) return { valid: false, message: "This voucher is no longer active." };
  if (new Date(voucher.startDate) > new Date(voucher.today)) return { valid: false, message: "This voucher isn't active yet." };
  if (new Date(voucher.endDate) < new Date(voucher.today)) return { valid: false, message: "This voucher has expired." };

  if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
    return { valid: false, message: "This voucher has reached its usage limit." };
  }
  if (voucher.minOrderAmount !== null && Number(orderAmount) < Number(voucher.minOrderAmount)) {
    return {
      valid: false,
      message: `This voucher needs a minimum order of $${Number(voucher.minOrderAmount).toFixed(2)}.`
    };
  }

  const discountAmount = voucher.discountType === "percentage"
    ? Math.min(Number(orderAmount), (Number(orderAmount) * Number(voucher.discountValue)) / 100)
    : Math.min(Number(orderAmount), Number(voucher.discountValue));

  return {
    valid: true,
    voucher,
    discountAmount: Math.round(discountAmount * 100) / 100,
    message: "Voucher applied."
  };
}

async function redeemVoucher(voucherId, orderId, discountAmount) {
  await sql.query`
    INSERT INTO VoucherRedemptions (voucherId, orderId, discountAmount)
    VALUES (${voucherId}, ${orderId}, ${discountAmount})
  `;
  await sql.query`
    UPDATE Vouchers SET usageCount = usageCount + 1 WHERE voucherId = ${voucherId}
  `;
}

module.exports = {
  getVouchersByStall,
  addVoucher,
  updateVoucher,
  deleteVoucher,
  validateVoucher,
  redeemVoucher
};
