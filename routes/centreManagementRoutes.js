const express = require('express');
const router = express.Router();

const centreManagementController = require('../controllers/centreManagementController');
const {
  validateCreateClosure,
  validateCreatePromotion,
  validateClonePromotion,
} = require('../middleware/centreManagementValidation');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Public browse — read-only centre status for diners and vendors, before the operator guard
router.get('/centres/:hawkerId/status', centreManagementController.getCentreStatus);
router.get('/stalls/:stallId/centre-status', centreManagementController.getStallCentreStatus);

// Every route below here is operator-only; access to a specific centre is further
// checked per-request against OperatorHawkerAssignments in the controller.
router.use(verifyToken, requireRole('operator'));

// Tab 1 — Closures & Operating Hours
router.get('/closures', centreManagementController.getClosures);
router.post('/closures', validateCreateClosure, centreManagementController.createClosure);
router.patch('/closures/:id/end', centreManagementController.endClosure);
router.patch('/closures/:id/cancel', centreManagementController.cancelClosure);

// Tab 2 — Operations Analytics
router.get('/analytics/:hawkerId', centreManagementController.getAnalytics);

// Tab 3 — Satisfaction
router.get('/satisfaction/:hawkerId', centreManagementController.getSatisfaction);
router.get('/satisfaction/:hawkerId/negative', centreManagementController.getNegativeFeedback);

// Tab 4 — Promotions
router.get('/stalls', centreManagementController.getStalls);
router.get('/promotions', centreManagementController.getPromotions);
router.post('/promotions', validateCreatePromotion, centreManagementController.createPromotion);
router.post('/promotions/:id/clone', validateClonePromotion, centreManagementController.clonePromotion);

module.exports = router;
