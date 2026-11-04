const sql = require('mssql');
const dbConfig = require('../dbConfig');

async function getStallFeedbackSummary(hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query(`
      SELECT AVG(CAST(sr.rating AS FLOAT)) AS AvgRating, COUNT(*) AS FeedbackCount
      FROM StallReviews sr
      JOIN Stalls s ON s.stallId = sr.stallId
      WHERE s.centreId = @HawkerId
    `);
  return result.recordset[0];
}

async function getNegativeStallFeedback(hawkerId, maxRating) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .input('MaxRating', sql.Int, maxRating)
    .query(`
      SELECT sr.reviewId, sr.comment AS Comment, sr.createdAt AS CreatedAt,
             sr.rating AS Rating, s.stallName AS StallName
      FROM StallReviews sr
      JOIN Stalls s ON s.stallId = sr.stallId
      WHERE s.centreId = @HawkerId AND sr.rating <= @MaxRating
      ORDER BY sr.createdAt DESC
    `);
  return result.recordset;
}

async function getStallFeedbackBreakdown(hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query(`
      SELECT s.stallId AS StallId, s.stallName AS StallName,
             COUNT(sr.reviewId) AS FeedbackCount, AVG(CAST(sr.rating AS FLOAT)) AS AvgRating
      FROM Stalls s
      LEFT JOIN StallReviews sr ON sr.stallId = s.stallId
      WHERE s.centreId = @HawkerId AND s.isActive = 1
      GROUP BY s.stallId, s.stallName
      ORDER BY s.stallName
    `);
  return result.recordset;
}

async function getHawkerFeedbackSummary(hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query(`
      SELECT AVG(CAST(Rating AS FLOAT)) AS AvgRating, COUNT(*) AS FeedbackCount
      FROM HawkerFeedback
      WHERE HawkerId = @HawkerId
    `);
  return result.recordset[0];
}

async function getHawkerFeedbackFacilityBreakdown(hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query(`
      SELECT FacilityTag, COUNT(*) AS FeedbackCount, AVG(CAST(Rating AS FLOAT)) AS AvgRating
      FROM HawkerFeedback
      WHERE HawkerId = @HawkerId
      GROUP BY FacilityTag
      ORDER BY FeedbackCount DESC
    `);
  return result.recordset;
}

// Compares the last 30 days' average rating against the 30 days before that.
async function getHawkerFeedbackTrend(hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query(`
      SELECT
        AVG(CASE WHEN CreatedAt >= DATEADD(DAY, -30, SYSDATETIME()) THEN CAST(Rating AS FLOAT) END) AS RecentAvg,
        AVG(CASE WHEN CreatedAt < DATEADD(DAY, -30, SYSDATETIME()) AND CreatedAt >= DATEADD(DAY, -60, SYSDATETIME()) THEN CAST(Rating AS FLOAT) END) AS PreviousAvg
      FROM HawkerFeedback
      WHERE HawkerId = @HawkerId
    `);
  return result.recordset[0];
}

async function getNegativeHawkerFeedback(hawkerId, maxRating) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .input('MaxRating', sql.Int, maxRating)
    .query(`
      SELECT FeedbackId, Comment, CreatedAt, Rating, FacilityTag
      FROM HawkerFeedback
      WHERE HawkerId = @HawkerId AND Rating <= @MaxRating
      ORDER BY CreatedAt DESC
    `);
  return result.recordset;
}

module.exports = {
  getStallFeedbackSummary,
  getStallFeedbackBreakdown,
  getHawkerFeedbackSummary,
  getHawkerFeedbackFacilityBreakdown,
  getHawkerFeedbackTrend,
  getNegativeStallFeedback,
  getNegativeHawkerFeedback,
};
