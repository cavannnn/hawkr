const sql = require('mssql');
const dbConfig = require('../dbConfig');

async function getAllHawkerCentres() {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query("SELECT * FROM HawkerCentres");
    return result.recordset;
}

async function getStallsByCentre(centreId) {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request()
        .input('cid', sql.Int, centreId)
        .query("SELECT * FROM Stalls WHERE centreId = @cid");
    return result.recordset;
}

module.exports = {
    getAllHawkerCentres,
    getStallsByCentre
};
