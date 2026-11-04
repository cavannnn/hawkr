const sql = require('mssql');
const dbConfig = require('../dbConfig');
const NotificationModel = require('./notificationModel');

async function getActiveStallsForHawker(hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query('SELECT stallId AS StallId, stallName AS StallName FROM Stalls WHERE centreId = @HawkerId AND isActive = 1 ORDER BY stallName');
  return result.recordset;
}

async function getPromotionsForHawker(hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM CentrePromotionStall cps WHERE cps.PromotionId = p.PromotionId) AS TargetedStallCount
      FROM CentrePromotion p
      WHERE p.HawkerId = @HawkerId
      ORDER BY p.CreatedAt DESC
    `);
  return result.recordset;
}

async function getPromotionById(promotionId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('PromotionId', sql.Int, promotionId)
    .query('SELECT * FROM CentrePromotion WHERE PromotionId = @PromotionId');
  return result.recordset[0];
}

async function getTargetedStalls(promotionId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('PromotionId', sql.Int, promotionId)
    .query(`
      SELECT s.stallId AS StallId, s.stallName AS StallName
      FROM CentrePromotionStall cps
      JOIN Stalls s ON s.stallId = cps.StallId
      WHERE cps.PromotionId = @PromotionId
    `);
  return result.recordset;
}

// stallIds: 'all' targets every active stall in the centre; otherwise an
// explicit array of StallIds (each is verified to belong to this centre).
async function createPromotion(data, stallIds) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, data.HawkerId)
    .input('Name', sql.NVarChar(100), data.Name)
    .input('Description', sql.NVarChar(500), data.Description || null)
    .input('DiscountType', sql.NVarChar(20), data.DiscountType)
    .input('DiscountValue', sql.Decimal(6, 2), data.DiscountValue)
    .input('StartDateTime', sql.DateTime2, data.StartDateTime)
    .input('EndDateTime', sql.DateTime2, data.EndDateTime)
    .input('CreatedByOperatorId', sql.Int, data.CreatedByOperatorId)
    .query(`
      INSERT INTO CentrePromotion (HawkerId, Name, Description, DiscountType, DiscountValue, StartDateTime, EndDateTime, CreatedByOperatorId)
      VALUES (@HawkerId, @Name, @Description, @DiscountType, @DiscountValue, @StartDateTime, @EndDateTime, @CreatedByOperatorId);
      SELECT SCOPE_IDENTITY() AS PromotionId;
    `);
  const promotionId = result.recordset[0].PromotionId;

  let targetIds = stallIds;
  if (stallIds === 'all') {
    const stallsResult = await pool
      .request()
      .input('HawkerId', sql.Int, data.HawkerId)
      .query('SELECT stallId AS StallId FROM Stalls WHERE centreId = @HawkerId AND isActive = 1');
    targetIds = stallsResult.recordset.map(r => r.StallId);
  }

  for (const stallId of targetIds) {
    await pool
      .request()
      .input('PromotionId', sql.Int, promotionId)
      .input('StallId', sql.Int, stallId)
      .query('INSERT INTO CentrePromotionStall (PromotionId, StallId) VALUES (@PromotionId, @StallId)');
  }

  await notifyTargetedVendors(promotionId, targetIds, data.Name);

  return promotionId;
}

async function notifyTargetedVendors(promotionId, stallIds, promotionName) {
  if (!stallIds.length) return;
  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  const idParams = stallIds.map((id, i) => {
    request.input(`sid${i}`, sql.Int, id);
    return `@sid${i}`;
  });
  const result = await request.query(`
    SELECT DISTINCT vendorId FROM Stalls
    WHERE stallId IN (${idParams.join(',')}) AND vendorId IS NOT NULL
  `);

  for (const row of result.recordset) {
    await NotificationModel.createNotification(
      row.vendorId,
      'centre_promotion',
      'New hawker-centre-wide promotion',
      `"${promotionName}" now applies to your stall automatically — no action needed.`,
      'storePromotions.html',
      'centrePromotion',
      promotionId
    );
  }
}

async function clonePromotion(sourcePromotion, targetHawkerId, createdByOperatorId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, targetHawkerId)
    .input('Name', sql.NVarChar(100), sourcePromotion.Name)
    .input('Description', sql.NVarChar(500), sourcePromotion.Description)
    .input('DiscountType', sql.NVarChar(20), sourcePromotion.DiscountType)
    .input('DiscountValue', sql.Decimal(6, 2), sourcePromotion.DiscountValue)
    .input('StartDateTime', sql.DateTime2, sourcePromotion.StartDateTime)
    .input('EndDateTime', sql.DateTime2, sourcePromotion.EndDateTime)
    .input('CreatedByOperatorId', sql.Int, createdByOperatorId)
    .query(`
      INSERT INTO CentrePromotion (HawkerId, Name, Description, DiscountType, DiscountValue, StartDateTime, EndDateTime, CreatedByOperatorId)
      VALUES (@HawkerId, @Name, @Description, @DiscountType, @DiscountValue, @StartDateTime, @EndDateTime, @CreatedByOperatorId);
      SELECT SCOPE_IDENTITY() AS PromotionId;
    `);
  return result.recordset[0].PromotionId;
}

async function stallsBelongToHawker(stallIds, hawkerId) {
  if (!stallIds.length) return true;
  const pool = await sql.connect(dbConfig);
  const request = pool.request().input('HawkerId', sql.Int, hawkerId);
  const idParams = stallIds.map((id, i) => {
    request.input(`sid${i}`, sql.Int, id);
    return `@sid${i}`;
  });
  const result = await request.query(`
    SELECT COUNT(*) AS MatchCount FROM Stalls WHERE centreId = @HawkerId AND stallId IN (${idParams.join(',')})
  `);
  return result.recordset[0].MatchCount === stallIds.length;
}

async function getPromotionStallMap(hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query(`
      SELECT cps.PromotionId, cps.StallId
      FROM CentrePromotionStall cps
      JOIN CentrePromotion p ON p.PromotionId = cps.PromotionId
      WHERE p.HawkerId = @HawkerId
    `);

  const byPromotion = new Map();
  for (const row of result.recordset) {
    if (!byPromotion.has(row.PromotionId)) byPromotion.set(row.PromotionId, []);
    byPromotion.get(row.PromotionId).push(row.StallId);
  }
  return byPromotion;
}

async function getPromotionsForStall(stallId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('StallId', sql.Int, stallId)
    .query(`
      SELECT p.*
      FROM CentrePromotion p
      JOIN CentrePromotionStall cps ON cps.PromotionId = p.PromotionId
      WHERE cps.StallId = @StallId
      ORDER BY p.PromotionId
    `);
  return result.recordset;
}

module.exports = {
  getActiveStallsForHawker,
  getPromotionsForHawker,
  getPromotionStallMap,
  getPromotionsForStall,
  getPromotionById,
  getTargetedStalls,
  createPromotion,
  clonePromotion,
  stallsBelongToHawker,
};
