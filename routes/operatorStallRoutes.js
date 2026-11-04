const express = require("express");
const router = express.Router();
const stallController = require("../controllers/stallController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");

// Only an operator account may review stall requests
const guard = [verifyToken, requireRole("operator")];

router.get("/stall-requests", guard, stallController.getPendingRequests);
router.put("/stall-requests/:requestId/approve", guard, stallController.approveRequest);
router.put("/stall-requests/:requestId/reject", guard, stallController.rejectRequest);

router.get("/rental-renewals", guard, stallController.getPendingRenewals);
router.put("/rental-renewals/:renewalId/approve", guard, stallController.approveRenewal);
router.put("/rental-renewals/:renewalId/reject", guard, stallController.rejectRenewal);

router.get("/stalls", guard, stallController.getMyChildren);
router.get("/stalls/:stallId", guard, stallController.getChildDetail);

module.exports = router;
