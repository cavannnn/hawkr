const sql = require('mssql');
const dbConfig = require('../dbConfig');

async function getProfileById(userId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('UserId', sql.Int, userId)
    .query(`
      SELECT userId AS UserId, username AS UserName, email AS Email,
             contactNumber AS PhoneNumber, profilePicture AS ProfilePhotoPath,
             role AS Role, createdAt AS CreatedAt
      FROM UserAccounts
      WHERE userId = @UserId
    `);
  return result.recordset[0];
}

async function getPasswordHash(userId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('UserId', sql.Int, userId)
    .query('SELECT passwordHash AS PasswordHash FROM UserAccounts WHERE userId = @UserId');
  return result.recordset[0]?.PasswordHash;
}

async function isUsernameTaken(userName, excludeUserId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('UserName', sql.NVarChar(50), userName)
    .input('ExcludeUserId', sql.Int, excludeUserId)
    .query('SELECT 1 FROM UserAccounts WHERE username = @UserName AND userId <> @ExcludeUserId');
  return result.recordset.length > 0;
}

async function isEmailTaken(email, excludeUserId) {
  if (!email) return false;
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('Email', sql.NVarChar(100), email)
    .input('ExcludeUserId', sql.Int, excludeUserId)
    .query('SELECT 1 FROM UserAccounts WHERE email = @Email AND userId <> @ExcludeUserId');
  return result.recordset.length > 0;
}

async function updateProfile(userId, { UserName, Email, PhoneNumber }) {
  const pool = await sql.connect(dbConfig);
  await pool
    .request()
    .input('UserId', sql.Int, userId)
    .input('UserName', sql.NVarChar(50), UserName)
    .input('Email', sql.NVarChar(100), Email || null)
    .input('PhoneNumber', sql.NVarChar(20), PhoneNumber || null)
    .query(`
      UPDATE UserAccounts
      SET username = @UserName, email = @Email, contactNumber = @PhoneNumber
      WHERE userId = @UserId
    `);
}

async function updateProfilePhoto(userId, storagePath) {
  const pool = await sql.connect(dbConfig);
  await pool
    .request()
    .input('UserId', sql.Int, userId)
    .input('ProfilePhotoPath', sql.NVarChar(500), storagePath)
    .query('UPDATE UserAccounts SET profilePicture = @ProfilePhotoPath WHERE userId = @UserId');
}

async function updatePasswordHash(userId, passwordHash) {
  const pool = await sql.connect(dbConfig);
  await pool
    .request()
    .input('UserId', sql.Int, userId)
    .input('PasswordHash', sql.NVarChar(255), passwordHash)
    .query('UPDATE UserAccounts SET passwordHash = @PasswordHash WHERE userId = @UserId');
}

async function deleteAccount(userId) {
  const pool = await sql.connect(dbConfig);
  await pool.request().input('UserId', sql.Int, userId)
    .query('DELETE FROM OperatorHawkerAssignments WHERE OperatorId = @UserId');
  await pool.request().input('UserId', sql.Int, userId)
    .query('DELETE FROM UserAccounts WHERE userId = @UserId');
}

// ---------- Hawker centre assignments ----------

async function getAssignedHawkerIds(operatorId) {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .input('OperatorId', sql.Int, operatorId)
    .query('SELECT HawkerId FROM OperatorHawkerAssignments WHERE OperatorId = @OperatorId');
  return result.recordset.map(r => r.HawkerId);
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

async function getAllHawkerCentres() {
  const pool = await sql.connect(dbConfig);
  const result = await pool
    .request()
    .query('SELECT centreId AS HawkerId, centreName AS Name FROM HawkerCentres WHERE isActive = 1 ORDER BY centreName');
  return result.recordset;
}

// Full replace: whatever hawkerIds is becomes the operator's complete assignment set.
async function setAssignedHawkerIds(operatorId, hawkerIds) {
  const pool = await sql.connect(dbConfig);
  await pool.request().input('OperatorId', sql.Int, operatorId)
    .query('DELETE FROM OperatorHawkerAssignments WHERE OperatorId = @OperatorId');

  for (const hawkerId of hawkerIds) {
    await pool
      .request()
      .input('OperatorId', sql.Int, operatorId)
      .input('HawkerId', sql.Int, hawkerId)
      .query('INSERT INTO OperatorHawkerAssignments (OperatorId, HawkerId) VALUES (@OperatorId, @HawkerId)');
  }
}

module.exports = {
  getProfileById,
  getPasswordHash,
  isUsernameTaken,
  isEmailTaken,
  updateProfile,
  updateProfilePhoto,
  updatePasswordHash,
  deleteAccount,
  getAssignedHawkerIds,
  getAssignedHawkerCentres,
  getAllHawkerCentres,
  setAssignedHawkerIds,
};
