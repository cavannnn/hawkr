const express = require("express");
const router = express.Router();
const vendorOrderController = require("../controllers/vendorOrderController");
const { verifyToken, requireRole, requireOwnId } = require("../middleware/authMiddleware");

// A vendor can only see and change orders placed at their own stalls
const guard = [verifyToken, requireRole("vendor"), requireOwnId("id")];

router.get("/:id/orders", guard, vendorOrderController.getOrders);
router.put("/:id/orders/:orderId/status", guard, vendorOrderController.updateOrderStatus);
router.delete("/:id/orders/history", guard, vendorOrderController.clearHistory);

module.exports = router;
