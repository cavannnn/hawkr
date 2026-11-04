const sql = require("mssql");

async function createUser(username, passwordHash, email, role, phone) {
  const result = await sql.query`
    INSERT INTO UserAccounts (username, passwordHash, email, role, contactNumber)
    VALUES (${username}, ${passwordHash}, ${email}, ${role}, ${phone || null})
  `;
  return result.rowsAffected[0] > 0;
}

async function findUserByUsername(username) {
  const result = await sql.query`
    SELECT * FROM UserAccounts WHERE username = ${username}
  `;
  return result.recordset[0];
}

async function findUserById(userId) {
  const result = await sql.query`
    SELECT userId, username, email, role, contactNumber
    FROM UserAccounts WHERE userId = ${userId}
  `;
  return result.recordset[0];
}

// Phone only — username/email are the account's identity and aren't editable
// from the customer profile page.
async function updateContactNumber(userId, phone) {
  const result = await sql.query`
    UPDATE UserAccounts SET contactNumber = ${phone} WHERE userId = ${userId}
  `;
  return result.rowsAffected[0] > 0;
}

module.exports = { createUser, findUserByUsername, findUserById, updateContactNumber };
