const express = require("express");
const router = express.Router();
const stallController = require("../controllers/stallController");
const promotionController = require("../controllers/promotionController");
const { verifyToken, requireRole, requireOwnId } = require("../middleware/authMiddleware");
const uploadStallImage = require("../middleware/uploadStallImage");

// A vendor can only see and change their own stalls
const guard = [verifyToken, requireRole("vendor"), requireOwnId("id")];

function handleStallImageUpload(req, res, next) {
  uploadStallImage.single("stallImage")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}

router.get("/:id/centres", guard, stallController.getCentres);
router.get("/:id/my-stalls", guard, stallController.getMyStalls);
router.post("/:id/stall-requests", guard, handleStallImageUpload, stallController.createRequest);

router.get("/:id/stalls/:stallId", guard, stallController.getStallDetail);
router.delete("/:id/stalls/:stallId", guard, stallController.deleteStall);
router.post("/:id/stalls/:stallId/menu", guard, stallController.addMenuItem);
router.put("/:id/stalls/:stallId/menu/:menuId", guard, stallController.updateMenuItem);
router.delete("/:id/stalls/:stallId/menu/:menuId", guard, stallController.deleteMenuItem);

router.post("/:id/stalls/:stallId/stock", guard, stallController.addStockItem);
router.put("/:id/stalls/:stallId/stock/:stockItemId", guard, stallController.updateStockItem);
router.delete("/:id/stalls/:stallId/stock/:stockItemId", guard, stallController.deleteStockItem);

router.post("/:id/stalls/:stallId/target", guard, stallController.setMonthlyTarget);

router.get("/:id/stalls/:stallId/reviews", guard, stallController.getStallReviews);

router.get("/:id/stalls/:stallId/rental", guard, stallController.getStallRental);
router.get("/:id/stalls/:stallId/rental/history", guard, stallController.getStallRentalHistory);
router.get("/:id/stalls/:stallId/rental/:agreementId/pdf", guard, stallController.downloadRentalAgreementPdf);
router.post("/:id/stalls/:stallId/rental/renew", guard, stallController.requestRentalRenewal);

router.get("/:id/stalls/:stallId/promotions", guard, promotionController.getPromotions);
router.post("/:id/stalls/:stallId/promotions", guard, promotionController.addPromotion);
router.put("/:id/stalls/:stallId/promotions/:promotionId", guard, promotionController.updatePromotion);
router.delete("/:id/stalls/:stallId/promotions/:promotionId", guard, promotionController.deletePromotion);

router.get("/:id/stalls/:stallId/vouchers", guard, promotionController.getVouchers);
router.post("/:id/stalls/:stallId/vouchers", guard, promotionController.addVoucher);
router.put("/:id/stalls/:stallId/vouchers/:voucherId", guard, promotionController.updateVoucher);
router.delete("/:id/stalls/:stallId/vouchers/:voucherId", guard, promotionController.deleteVoucher);

module.exports = router;
