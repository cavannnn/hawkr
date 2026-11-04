const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const searchController = require("../controllers/vendorSearchController");
const { verifyToken, requireRole, requireOwnId } = require("../middleware/authMiddleware");

// A vendor can only search/see notifications for their own account
const guard = [verifyToken, requireRole("vendor"), requireOwnId("id")];

router.get("/:id/search", guard, searchController.search);

router.get("/:id/notifications", guard, notificationController.getNotifications);
router.put("/:id/notifications/read-all", guard, notificationController.markAllRead);
router.put("/:id/notifications/:notificationId/read", guard, notificationController.markRead);
router.delete("/:id/notifications/:notificationId", guard, notificationController.deleteNotification);

module.exports = router;
