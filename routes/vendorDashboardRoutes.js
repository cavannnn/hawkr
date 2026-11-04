const express = require("express");
const router = express.Router();
const Dashboard = require("../models/vendorDashboardModel");
const dashboardController = require("../controllers/vendorDashboardController");
const { verifyToken, requireRole, requireOwnId } = require("../middleware/authMiddleware");

const guard = [verifyToken, requireRole("vendor"), requireOwnId("id")];

// Dashboard metrics
router.get("/:id/dashboard", guard, dashboardController.getDashboard);
router.put("/:id/dashboard", guard, dashboardController.updateDashboard);
router.post("/:id/dashboard/goal", guard, dashboardController.setGoal);

// Real-time dashboard data
router.get("/:id/dashboard/live", guard, async (req, res) => {
  try {
    const dashboard = await Dashboard.getDashboardByVendorId(req.params.id);
    res.json(dashboard);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
