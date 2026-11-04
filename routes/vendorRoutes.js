const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendorController");
const { verifyToken, requireRole, requireOwnId } = require("../middleware/authMiddleware");
const uploadAvatar = require("../middleware/uploadAvatar");

const guard = [verifyToken, requireRole("vendor"), requireOwnId("id")];

router.get("/:id/profile", guard, vendorController.getVendorProfile);
router.put("/:id/profile", guard, vendorController.updateVendorProfile);

function handleAvatarUpload(req, res, next) {
  uploadAvatar.single("profilePicture")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}

router.post("/:id/profile/picture", guard, handleAvatarUpload, vendorController.uploadProfilePicture);

module.exports = router;
