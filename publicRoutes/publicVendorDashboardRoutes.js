const express = require("express");
const router = express.Router();
const sql = require("mssql");

// Public: get vendor dashboard by ID
router.get("/:id/dashboard", async (req, res) => {
  try {
    const result = await sql.query`
      SELECT * FROM VendorDashboard WHERE vendorId = ${req.params.id}
    `;
    if (result.recordset.length === 0) {
      return res.status(404).json({ message: "Dashboard not found" });
    }
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
