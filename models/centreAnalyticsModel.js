const sql = require('mssql');
const dbConfig = require('../dbConfig');

// period: 'week' (last 7 days) or 'month' (last 30 days)
function sinceDateFor(period) {
  const days = period === 'month' ? 30 : 7;
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}

async function getOrderVolumeByHour(hawkerId, period) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .input('Since', sql.DateTime2, sinceDateFor(period))
    .query(`
      SELECT DATEPART(HOUR, o.orderDate) AS HourOfDay, COUNT(*) AS OrderCount
      FROM Orders o
      JOIN Stalls s ON s.stallId = o.stallId
      WHERE s.centreId = @HawkerId AND o.orderDate >= @Since
      GROUP BY DATEPART(HOUR, o.orderDate)
      ORDER BY HourOfDay
    `);
  return result.recordset;
}

async function getOrderVolumeByDay(hawkerId, period) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .input('Since', sql.DateTime2, sinceDateFor(period))
    .query(`
      SELECT CAST(o.orderDate AS DATE) AS OrderDay, COUNT(*) AS OrderCount
      FROM Orders o
      JOIN Stalls s ON s.stallId = o.stallId
      WHERE s.centreId = @HawkerId AND o.orderDate >= @Since
      GROUP BY CAST(o.orderDate AS DATE)
      ORDER BY OrderDay
    `);
  return result.recordset;
}

async function getStallUtilisation(hawkerId, period) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .input('Since', sql.DateTime2, sinceDateFor(period))
    .query(`
      SELECT s.stallId AS StallId, s.stallName AS StallName, COUNT(o.orderId) AS OrderCount
      FROM Stalls s
      LEFT JOIN Orders o ON o.stallId = s.stallId AND o.orderDate >= @Since
      WHERE s.centreId = @HawkerId AND s.isActive = 1
      GROUP BY s.stallId, s.stallName
      ORDER BY OrderCount ASC
    `);
  return result.recordset;
}

async function getCentreOrderTotal(hawkerId, period) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .input('Since', sql.DateTime2, sinceDateFor(period))
    .query(`
      SELECT COUNT(*) AS OrderCount
      FROM Orders o
      JOIN Stalls s ON s.stallId = o.stallId
      WHERE s.centreId = @HawkerId AND o.orderDate >= @Since
    `);
  return result.recordset[0].OrderCount;
}

module.exports = {
  getOrderVolumeByHour,
  getOrderVolumeByDay,
  getStallUtilisation,
  getCentreOrderTotal,
};
