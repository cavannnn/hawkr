const sql = require('mssql');
const dbConfig = require('../dbConfig');

// Get all archived rental agreements, most recently archived first
async function getAllHistory() {
  const pool = await sql.connect(dbConfig);
  const result = await pool.request().query('SELECT * FROM RentalAgreementHistory ORDER BY ArchivedAt DESC');
  return result.recordset;
}

// Get one archived rental agreement by its history entry ID
async function getHistoryById(id) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM RentalAgreementHistory WHERE HistoryId = @id');
  return result.recordset[0];
}

// Archive a rental agreement as either 'Expired' or 'Cancelled'
async function createHistoryEntry(agreement, status) {
  const pool = await sql.connect(dbConfig);
  await pool
    .request()
    .input('AgreementId', sql.SmallInt, agreement.AgreementId)
    .input('AgreementStartDate', sql.DateTime2, agreement.AgreementStartDate)
    .input('AgreementEndDate', sql.DateTime2, agreement.AgreementEndDate)
    .input('AgreementTermsAndConditions', sql.VarChar(sql.MAX), agreement.AgreementTermsAndConditions)
    .input('RentalPrice', sql.Decimal(10, 2), agreement.RentalPrice)
    .input('OwnerId', sql.SmallInt, agreement.OwnerId)
    .input('StallId', sql.Int, agreement.StallId)
    .input('Status', sql.VarChar(20), status)
    .query(`
      INSERT INTO RentalAgreementHistory
        (AgreementId, AgreementStartDate, AgreementEndDate, AgreementTermsAndConditions, RentalPrice, OwnerId, StallId, Status)
      VALUES
        (@AgreementId, @AgreementStartDate, @AgreementEndDate, @AgreementTermsAndConditions, @RentalPrice, @OwnerId, @StallId, @Status)
    `);
}

module.exports = { getAllHistory, getHistoryById, createHistoryEntry };
