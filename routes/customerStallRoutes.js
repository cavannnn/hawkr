const express = require('express');
const router = express.Router();
const stallController = require('../controllers/customerStallController');

// GET all stalls
router.get('/', stallController.getAllStalls);

// GET a stall's live promotions
router.get('/:stallId/promotions', stallController.getStallPromotions);

// GET stall by ID
router.get('/:stallId', stallController.getStallById);

module.exports = router;
