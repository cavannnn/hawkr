/* allergenModel.js — a customer's saved allergens. */
const sql = require('mssql');
const dbConfig = require('../dbConfig');

class AllergenModel {
  // Returns rows; the controller decides which are standard and which are custom.
  static async getUserAllergens(userId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT allergenName, createdAt
          FROM UserAllergens
          WHERE userId = @userId
          ORDER BY createdAt ASC
      `);
    return result.recordset;
  }

  /* names is the complete list — standard ids and custom labels together. The caller has
     already validated them; this only has to store them. */
  static async replaceUserAllergens(userId, names) {
    const pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      await new sql.Request(transaction)
        .input('userId', sql.Int, userId)
        .query('DELETE FROM UserAllergens WHERE userId = @userId');

      // Parameterised per row rather than a built-up VALUES list — a custom allergen is
      // free text the customer typed, so it never goes into the SQL string.
      for (const name of names) {
        await new sql.Request(transaction)
          .input('userId', sql.Int, userId)
          .input('allergenName', sql.NVarChar(50), name)
          .query(`
            INSERT INTO UserAllergens (userId, allergenName)
              VALUES (@userId, @allergenName)
          `);
      }

      await transaction.commit();
      return names.length;
    } catch (error) {
      // Leave the customer with their previous set rather than a half-written one.
      await transaction.rollback();
      throw error;
    }
  }
}

module.exports = AllergenModel;
