const sql = require('mssql');
const dbConfig = require('../dbConfig');

// Get all rental agreements
async function getAllRentalAgreements() {
  const pool = await sql.connect(dbConfig);
  const result = await pool.request().query('SELECT * FROM RentalAgreements');
  return result.recordset;
}

// Get one rental agreement by ID
async function getRentalAgreementById(id) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM RentalAgreements WHERE AgreementID = @id');
  return result.recordset[0];
}

// All agreements for one stall, newest start first. Backs both the vendor's
// current/upcoming view and the rental history list (status is derived from dates).
async function getAgreementsByStall(stallId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('StallId', sql.Int, stallId)
    .query('SELECT * FROM RentalAgreements WHERE StallId = @StallId ORDER BY AgreementStartDate DESC');
  return result.recordset;
}

async function getOperatorUsername(pool, ownerId) {
  const result = await pool
    .request()
    .input('OwnerId', sql.Int, ownerId)
    .query('SELECT username FROM UserAccounts WHERE userId = @OwnerId');
  return result.recordset[0] ? result.recordset[0].username : null;
}

async function createRentalAgreement(data) {
  const pool = await sql.connect(dbConfig);
  const contractName = await getOperatorUsername(pool, data.OwnerId);
  const result = await pool
    .request()
    .input('StallId', sql.Int, data.StallId)
    .input('OwnerId', sql.SmallInt, data.OwnerId)
    .input('AgreementStartDate', sql.DateTime2, data.AgreementStartDate)
    .input('AgreementEndDate', sql.DateTime2, data.AgreementEndDate)
    .input('AgreementTermsAndConditions', sql.VarChar(sql.MAX), data.AgreementTermsAndConditions)
    .input('RentalPrice', sql.Decimal(10, 2), data.RentalPrice)
    .input('ContractName', sql.VarChar(100), contractName)
    .query(`
      INSERT INTO RentalAgreements (StallId, OwnerId, AgreementStartDate, AgreementEndDate, AgreementTermsAndConditions, RentalPrice, ContractType, ContractName)
      VALUES (@StallId, @OwnerId, @AgreementStartDate, @AgreementEndDate, @AgreementTermsAndConditions, @RentalPrice, 'Fixed Price', @ContractName);
      SELECT SCOPE_IDENTITY() AS AgreementId;
    `);
  return result.recordset[0].AgreementId;
}

// Update an existing rental agreement
async function updateRentalAgreement(id, data) {
  const pool = await sql.connect(dbConfig);
  const contractName = await getOperatorUsername(pool, data.OwnerId);
  await pool
    .request()
    .input('AgreementId', sql.SmallInt, id)
    .input('StallId', sql.Int, data.StallId)
    .input('OwnerId', sql.Int, data.OwnerId)
    .input('AgreementEndDate', sql.DateTime2, data.AgreementEndDate)
    .input('AgreementTermsAndConditions', sql.VarChar(sql.MAX), data.AgreementTermsAndConditions)
    .input('RentalPrice', sql.Decimal(10, 2), data.RentalPrice)
    .input('ContractName', sql.VarChar(100), contractName)
    .query(`
      UPDATE RentalAgreements
      SET StallId = @StallId,
          OwnerId = @OwnerId,
          AgreementEndDate = @AgreementEndDate,
          AgreementTermsAndConditions = @AgreementTermsAndConditions,
          RentalPrice = @RentalPrice,
          ContractName = @ContractName
      WHERE AgreementId = @AgreementId
    `);
}

// Delete a rental agreement
async function deleteRentalAgreement(id) {
  const pool = await sql.connect(dbConfig);
  await pool
    .request()
    .input('AgreementId', sql.SmallInt, id)
    .query('DELETE FROM RentalAgreements WHERE AgreementId = @AgreementId');
}

module.exports = {
  getAllRentalAgreements,
  getRentalAgreementById,
  getAgreementsByStall,
  createRentalAgreement,
  updateRentalAgreement,
  deleteRentalAgreement,
};