const express = require('express');
const router = express.Router();
const hawkerController = require('../controllers/hawkerController');
const hawkerFeedbackController = require('../controllers/hawkerFeedbackController');
const { verifyToken } = require('../middleware/authMiddleware');

// GET all hawker centres
router.get('/', hawkerController.getAllHawkers);

router.get('/feedback/tags', hawkerFeedbackController.getFacilityTags);
router.get('/feedback/mine', verifyToken, hawkerFeedbackController.getMyFeedback);
router.post('/:hawkerId/feedback', verifyToken, hawkerFeedbackController.submitFeedback);

// GET hawker centre by ID
router.get('/:hawkerId', hawkerController.getHawkerById);

module.exports = router;
