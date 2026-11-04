const sql = require('mssql');
const dbConfig = require('../dbConfig');
const { MAX_CUISINES } = require('../config/cuisines');

class CuisineModel {
  // Returns rows in the order they were chosen; the controller flattens them to names.
  static async getUserCuisines(userId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT cuisineName, createdAt
          FROM UserCuisines
          WHERE userId = @userId
          ORDER BY createdAt ASC
      `);
    return result.recordset;
  }

  /* names is the complete list. The caller has already validated the vocabulary; this only
     has to store it — plus the one check the database cannot make for itself. */
  static async replaceUserCuisines(userId, names) {
    /* A 500, not a 400, and deliberately. Reaching here with six means a route was wired
       without its validator, which is a fault in this server rather than in the request. */
    if (names.length > MAX_CUISINES) {
      throw new Error('replaceUserCuisines called with ' + names.length +
        ' cuisines; the maximum is ' + MAX_CUISINES);
    }

    const pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction)
        .input('userId', sql.Int, userId)
        .query('DELETE FROM UserCuisines WHERE userId = @userId');

      for (const name of names) {
        await new sql.Request(transaction)
          .input('userId', sql.Int, userId)
          .input('cuisineName', sql.NVarChar(50), name)
          .query(`
            INSERT INTO UserCuisines (userId, cuisineName)
              VALUES (@userId, @cuisineName)
          `);
      }

      await transaction.commit();
      return names.length;
    } catch (error) {
      // Leave the customer with their previous palette rather than a half-written one.
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = CuisineModel;
