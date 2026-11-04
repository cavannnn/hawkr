const Dashboard = require("../models/vendorDashboardModel");

// GET vendor dashboard by vendorId
async function getDashboard(req, res) {
  const vendorId = req.params.id;
  try {
    // A vendor with no orders yet will show 0
    const dashboard = await Dashboard.getDashboardByVendorId(vendorId);
    res.json(dashboard);
  } catch (err) {
    console.error("Error fetching dashboard:", err);
    res.status(500).json({ message: err.message });
  }
}

// vendor dashboard metrics
async function updateDashboard(req, res) {
  const vendorId = req.params.id;
  const data = req.body;
  try {
    await Dashboard.updateDashboard(vendorId, data);
    res.json({ message: "Dashboard updated successfully" });
  } catch (err) {
    console.error("Error updating dashboard:", err);
    res.status(500).json({ message: err.message });
  }
}

// SET the vendor's monthly revenue goal (used by the Order Summary gauge)
async function setGoal(req, res) {
  const vendorId = req.params.id;
  const { monthlyGoal } = req.body;

  if (!monthlyGoal || Number(monthlyGoal) <= 0) {
    return res.status(400).json({ message: "A monthly goal greater than 0 is required." });
  }

  try {
    await Dashboard.setMonthlyGoal(vendorId, monthlyGoal);
    res.json({ message: "Monthly goal saved.", monthlyGoal: Number(monthlyGoal) });
  } catch (err) {
    console.error("Error saving monthly goal:", err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getDashboard, updateDashboard, setGoal };
