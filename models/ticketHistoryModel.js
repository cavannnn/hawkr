const sql = require('mssql');
const dbConfig = require('../dbConfig');

async function insertHistory(entry) {
  const pool = await sql.connect(dbConfig);
  await pool
    .request()
    .input('TicketId', sql.Int, entry.TicketId)
    .input('UserId', sql.Int, entry.UserId)
    .input('UserRole', sql.NVarChar(20), entry.UserRole)
    .input('Category', sql.NVarChar(30), entry.Category)
    .input('TicketDescription', sql.NVarChar(sql.MAX), entry.TicketDescription)
    .input('Message', sql.NVarChar(sql.MAX), entry.Message)
    .input('Status', sql.NVarChar(20), entry.Status)
    .input('ResolvedByUserId', sql.Int, entry.ResolvedByUserId)
    .query(`
      INSERT INTO TicketHistory (TicketId, UserId, UserRole, Category, TicketDescription, Message, Status, ResolvedByUserId)
      VALUES (@TicketId, @UserId, @UserRole, @Category, @TicketDescription, @Message, @Status, @ResolvedByUserId)
    `);
}

async function getLatestHistoryForTicket(ticketId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('TicketId', sql.Int, ticketId)
    .query(`
      SELECT TOP 1 th.*, resolver.username AS ResolvedByUserName
      FROM TicketHistory th
      JOIN UserAccounts resolver ON resolver.userId = th.ResolvedByUserId
      WHERE th.TicketId = @TicketId
      ORDER BY th.CompletedAt DESC
    `);
  return result.recordset[0];
}

async function getHistoryForSubmitter(userId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('UserId', sql.Int, userId)
    .query('SELECT * FROM TicketHistory WHERE UserId = @UserId ORDER BY CompletedAt DESC');
  return result.recordset;
}

async function getHistoryForOperator({ hawkerIds, category, outcome, dateFrom, dateTo }) {
  if (!hawkerIds.length) return [];

  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  const idParams = hawkerIds.map((id, i) => {
    request.input(`hid${i}`, sql.Int, id);
    return `@hid${i}`;
  });

  let query = `
    SELECT th.*, t.HawkerId, t.Subject, hc.centreName AS HawkerName,
           submitter.username AS SubmitterUserName, resolver.username AS ResolvedByUserName
    FROM TicketHistory th
    JOIN Tickets t ON t.TicketId = th.TicketId
    JOIN HawkerCentres hc ON hc.centreId = t.HawkerId
    JOIN UserAccounts submitter ON submitter.userId = th.UserId
    JOIN UserAccounts resolver ON resolver.userId = th.ResolvedByUserId
    WHERE t.HawkerId IN (${idParams.join(',')})
  `;

  if (category) {
    request.input('FilterCategory', sql.NVarChar(30), category);
    query += ' AND th.Category = @FilterCategory';
  }
  if (outcome) {
    request.input('FilterOutcome', sql.NVarChar(20), outcome);
    query += ' AND th.Status = @FilterOutcome';
  }
  if (dateFrom) {
    request.input('DateFrom', sql.DateTime2, dateFrom);
    query += ' AND th.CompletedAt >= @DateFrom';
  }
  if (dateTo) {
    request.input('DateTo', sql.DateTime2, dateTo);
    query += ' AND th.CompletedAt <= @DateTo';
  }

  query += ' ORDER BY th.CompletedAt DESC';

  const result = await request.query(query);
  return result.recordset;
}

async function getHistoryById(ticketHistoryId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('TicketHistoryId', sql.Int, ticketHistoryId)
    .query('SELECT * FROM TicketHistory WHERE TicketHistoryId = @TicketHistoryId');
  return result.recordset[0];
}

module.exports = {
  insertHistory,
  getLatestHistoryForTicket,
  getHistoryForSubmitter,
  getHistoryForOperator,
  getHistoryById,
};
