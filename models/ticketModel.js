const sql = require('mssql');
const dbConfig = require('../dbConfig');

const TERMINAL_STATUSES = ['Completed', 'Unresolvable'];

// ---------- Hawker centres ----------

async function getHawkerCentres() {
  const pool = await sql.connect(dbConfig);
  const result = await pool.request().query(`
    SELECT centreId AS HawkerId, centreName AS Name
    FROM HawkerCentres
    WHERE isActive = 1
    ORDER BY centreName
  `);
  return result.recordset;
}

async function getAssignedHawkerCentres(operatorId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('OperatorId', sql.Int, operatorId)
    .query(`
      SELECT hc.centreId AS HawkerId, hc.centreName AS Name
      FROM OperatorHawkerAssignments oha
      JOIN HawkerCentres hc ON hc.centreId = oha.HawkerId
      WHERE oha.OperatorId = @OperatorId
      ORDER BY hc.centreName
    `);
  return result.recordset;
}

async function getAssignedHawkerIds(operatorId) {
  const centres = await getAssignedHawkerCentres(operatorId);
  return centres.map(c => c.HawkerId);
}

async function isOperatorAssignedToHawker(operatorId, hawkerId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('OperatorId', sql.Int, operatorId)
    .input('HawkerId', sql.Int, hawkerId)
    .query('SELECT 1 FROM OperatorHawkerAssignments WHERE OperatorId = @OperatorId AND HawkerId = @HawkerId');
  return result.recordset.length > 0;
}

// ---------- Tickets ----------

async function createTicket(data) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, data.HawkerId)
    .input('UserId', sql.Int, data.UserId)
    .input('UserRole', sql.NVarChar(20), data.UserRole)
    .input('Category', sql.NVarChar(30), data.Category)
    .input('OtherCategoryText', sql.NVarChar(100), data.OtherCategoryText || null)
    .input('Subject', sql.NVarChar(150), data.Subject)
    .input('Description', sql.NVarChar(sql.MAX), data.Description)
    .query(`
      INSERT INTO Tickets (HawkerId, UserId, UserRole, Category, OtherCategoryText, Subject, Description)
      VALUES (@HawkerId, @UserId, @UserRole, @Category, @OtherCategoryText, @Subject, @Description);
      SELECT SCOPE_IDENTITY() AS TicketId;
    `);
  return result.recordset[0].TicketId;
}

async function addAttachments(ticketId, attachments) {
  if (!attachments.length) return;
  const pool = await sql.connect(dbConfig);
  for (const file of attachments) {
    await pool
      .request()
      .input('TicketId', sql.Int, ticketId)
      .input('FileName', sql.NVarChar(255), file.fileName)
      .input('FileType', sql.NVarChar(20), file.fileType)
      .input('FileSizeBytes', sql.Int, file.fileSizeBytes)
      .input('StoragePath', sql.NVarChar(500), file.storagePath)
      .query(`
        INSERT INTO TicketAttachments (TicketId, FileName, FileType, FileSizeBytes, StoragePath)
        VALUES (@TicketId, @FileName, @FileType, @FileSizeBytes, @StoragePath)
      `);
  }
}

async function getAttachmentsByTicketId(ticketId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('TicketId', sql.Int, ticketId)
    .query('SELECT * FROM TicketAttachments WHERE TicketId = @TicketId ORDER BY UploadedAt');
  return result.recordset;
}

async function getTicketById(ticketId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('TicketId', sql.Int, ticketId)
    .query(`
      SELECT t.*, submitter.username AS SubmitterUserName, hc.centreName AS HawkerName
      FROM Tickets t
      JOIN UserAccounts submitter ON submitter.userId = t.UserId
      JOIN HawkerCentres hc ON hc.centreId = t.HawkerId
      WHERE t.TicketId = @TicketId
    `);
  return result.recordset[0];
}

// statusGroup: 'open' (non-terminal) or 'closed' (terminal)
function statusGroupClause(statusGroup) {
  return statusGroup === 'closed'
    ? `Status IN ('${TERMINAL_STATUSES.join("','")}')`
    : `Status NOT IN ('${TERMINAL_STATUSES.join("','")}')`;
}

async function getTicketsForSubmitter(userId, statusGroup) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('UserId', sql.Int, userId)
    .query(`
      SELECT * FROM Tickets
      WHERE UserId = @UserId AND ${statusGroupClause(statusGroup)}
      ORDER BY CreatedAt DESC
    `);
  return result.recordset;
}

async function getTicketsForOperator({ hawkerIds, statusGroup, category, hawkerId, status }) {
  if (!hawkerIds.length) return [];

  const pool = await sql.connect(dbConfig);
  const request = pool.request();
  const idParams = hawkerIds.map((id, i) => {
    request.input(`hid${i}`, sql.Int, id);
    return `@hid${i}`;
  });

  let query = `
    SELECT t.*, hc.centreName AS HawkerName
    FROM Tickets t
    JOIN HawkerCentres hc ON hc.centreId = t.HawkerId
    WHERE t.HawkerId IN (${idParams.join(',')}) AND ${statusGroupClause(statusGroup).replace(/\bStatus\b/g, 't.Status')}
  `;

  if (hawkerId) {
    request.input('FilterHawkerId', sql.Int, hawkerId);
    query += ' AND t.HawkerId = @FilterHawkerId';
  }
  if (category) {
    request.input('FilterCategory', sql.NVarChar(30), category);
    query += ' AND t.Category = @FilterCategory';
  }
  // Narrows the open/closed group down to one exact status, e.g. 'Testing'
  if (status) {
    request.input('FilterStatus', sql.NVarChar(20), status);
    query += ' AND t.Status = @FilterStatus';
  }

  query += statusGroup === 'closed' ? ' ORDER BY t.UpdatedAt DESC' : ' ORDER BY t.CreatedAt ASC';

  const result = await request.query(query);
  return result.recordset;
}

async function claimTicket(ticketId, operatorId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('TicketId', sql.Int, ticketId)
    .input('OperatorId', sql.Int, operatorId)
    .query(`
      UPDATE Tickets
      SET AssignedOperatorId = @OperatorId, Status = 'In Progress', UpdatedAt = SYSDATETIME()
      WHERE TicketId = @TicketId AND Status = 'Open' AND AssignedOperatorId IS NULL
    `);
  return result.rowsAffected[0] > 0;
}

async function updateStatus(ticketId, operatorId, status) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('TicketId', sql.Int, ticketId)
    .input('OperatorId', sql.Int, operatorId)
    .input('Status', sql.NVarChar(20), status)
    .query(`
      UPDATE Tickets
      SET Status = @Status, UpdatedAt = SYSDATETIME()
      WHERE TicketId = @TicketId AND AssignedOperatorId = @OperatorId
    `);
  return result.rowsAffected[0] > 0;
}

async function closeTicket(ticketId, outcome) {
  const pool = await sql.connect(dbConfig);
  await pool
    .request()
    .input('TicketId', sql.Int, ticketId)
    .input('Status', sql.NVarChar(20), outcome)
    .query(`
      UPDATE Tickets
      SET Status = @Status, UpdatedAt = SYSDATETIME()
      WHERE TicketId = @TicketId
    `);
}

module.exports = {
  getHawkerCentres,
  getAssignedHawkerCentres,
  getAssignedHawkerIds,
  isOperatorAssignedToHawker,
  createTicket,
  addAttachments,
  getAttachmentsByTicketId,
  getTicketById,
  getTicketsForSubmitter,
  getTicketsForOperator,
  claimTicket,
  updateStatus,
  closeTicket,
  TERMINAL_STATUSES,
};
