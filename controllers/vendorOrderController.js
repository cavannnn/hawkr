const OrderModel = require("../models/orderModel");

const ACTIVE_STATUSES = ["pending", "preparing", "ready"];
const HISTORY_STATUSES = ["completed", "cancelled"];
const VALID_STATUSES = ["pending", "preparing", "ready", "completed", "cancelled"];

// GET orders for every stall this vendor owns. ?view=active (default) 
async function getOrders(req, res) {
  const vendorId = req.params.id;
  const view = req.query.view || "active";

  let statuses = ACTIVE_STATUSES;
  if (view === "history") statuses = HISTORY_STATUSES;
  else if (view === "all") statuses = null;

  try {
    const orders = await OrderModel.findByVendor(vendorId, statuses);
    res.json({ orders });
  } catch (err) {
    console.error("Error fetching vendor orders:", err);
    res.status(500).json({ message: err.message });
  }
}

async function updateOrderStatus(req, res) {
  const vendorId = req.params.id;
  const { orderId } = req.params;
  const { status } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid order status." });
  }

  try {
    const result = await OrderModel.updateStatusForVendor(vendorId, orderId, status);
    if (result === "not found") {
      return res.status(404).json({ message: "Order not found, or it doesn't belong to one of your stalls." });
    }
    res.json({ message: "Order status updated." });
  } catch (err) {
    console.error("Error updating vendor order status:", err);
    res.status(500).json({ message: err.message });
  }
}

async function clearHistory(req, res) {
  const vendorId = req.params.id;
  try {
    const count = await OrderModel.clearCompletedForVendor(vendorId);
    res.json({ message: count + " order(s) cleared from history." });
  } catch (err) {
    console.error("Error clearing vendor order history:", err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = { getOrders, updateOrderStatus, clearHistory };
