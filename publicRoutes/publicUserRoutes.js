const express = require("express");
const router = express.Router();
const sql = require("mssql");

// Public: list all vendors
router.get("/vendors", async (req, res) => {
  try {
    const result = await sql.query`
      SELECT userId, username, email 
      FROM UserAccounts 
      WHERE role = 'vendor'
    `;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Public: list all customers
router.get("/customers", async (req, res) => {
  try {
    const result = await sql.query`
      SELECT userId, username, email 
      FROM UserAccounts 
      WHERE role = 'customer'
    `;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
