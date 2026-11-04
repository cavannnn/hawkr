const sql = require('mssql');
const dbConfig = require('../dbConfig');

async function reconcileStatuses(hawkerId) {
  const pool = await sql.connect(dbConfig);
  await pool.request().input('HawkerId', sql.Int, hawkerId).query(`
    UPDATE CentreClosure
    SET Status = 'Active'
    WHERE HawkerId = @HawkerId AND Status = 'Scheduled'
      AND StartDateTime <= SYSDATETIME() AND EndDateTime > SYSDATETIME()
  `);
  await pool.request().input('HawkerId', sql.Int, hawkerId).query(`
    UPDATE CentreClosure
    SET Status = 'Completed'
    WHERE HawkerId = @HawkerId AND Status IN ('Scheduled', 'Active')
      AND EndDateTime <= SYSDATETIME()
  `);
}

async function getClosuresForHawker(hawkerId) {
  await reconcileStatuses(hawkerId);
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query('SELECT * FROM CentreClosure WHERE HawkerId = @HawkerId ORDER BY StartDateTime DESC');
  return result.recordset;
}

async function isCentreCurrentlyClosed(hawkerId) {
  await reconcileStatuses(hawkerId);
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .query("SELECT 1 FROM CentreClosure WHERE HawkerId = @HawkerId AND Status = 'Active'");
  return result.recordset.length > 0;
}

async function hasOverlap(hawkerId, startDateTime, endDateTime, excludeClosureId) {
  const pool = await sql.connect(dbConfig);
  const request = pool
    .request()
    .input('HawkerId', sql.Int, hawkerId)
    .input('Start', sql.DateTime2, startDateTime)
    .input('End', sql.DateTime2, endDateTime);

  let query = `
    SELECT 1 FROM CentreClosure
    WHERE HawkerId = @HawkerId AND Status IN ('Scheduled', 'Active')
      AND StartDateTime < @End AND EndDateTime > @Start
  `;
  if (excludeClosureId) {
    request.input('ExcludeId', sql.Int, excludeClosureId);
    query += ' AND ClosureId <> @ExcludeId';
  }

  const result = await request.query(query);
  return result.recordset.length > 0;
}

async function createClosure(data) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('HawkerId', sql.Int, data.HawkerId)
    .input('Reason', sql.NVarChar(30), data.Reason)
    .input('StartDateTime', sql.DateTime2, data.StartDateTime)
    .input('EndDateTime', sql.DateTime2, data.EndDateTime)
    .input('CreatedByOperatorId', sql.Int, data.CreatedByOperatorId)
    .input('Notes', sql.NVarChar(500), data.Notes || null)
    .query(`
      INSERT INTO CentreClosure (HawkerId, Reason, StartDateTime, EndDateTime, CreatedByOperatorId, Notes)
      VALUES (@HawkerId, @Reason, @StartDateTime, @EndDateTime, @CreatedByOperatorId, @Notes);
      SELECT SCOPE_IDENTITY() AS ClosureId;
    `);
  return result.recordset[0].ClosureId;
}

async function getClosureById(closureId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('ClosureId', sql.Int, closureId)
    .query('SELECT * FROM CentreClosure WHERE ClosureId = @ClosureId');
  return result.recordset[0];
}

async function endClosureEarly(closureId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('ClosureId', sql.Int, closureId)
    .query(`
      UPDATE CentreClosure
      SET Status = 'Completed', EndDateTime = SYSDATETIME()
      WHERE ClosureId = @ClosureId AND Status = 'Active'
    `);
  return result.rowsAffected[0] > 0;
}

async function cancelClosure(closureId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('ClosureId', sql.Int, closureId)
    .query(`
      UPDATE CentreClosure
      SET Status = 'Cancelled'
      WHERE ClosureId = @ClosureId AND Status = 'Scheduled'
    `);
  return result.rowsAffected[0] > 0;
}

module.exports = {
  getClosuresForHawker,
  isCentreCurrentlyClosed,
  hasOverlap,
  createClosure,
  getClosureById,
  endClosureEarly,
  cancelClosure,
};
