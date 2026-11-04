/* allergenRoutes.js — a customer's saved allergens. */
const express = require('express');
const router = express.Router();
const allergenController = require('../controllers/allergenController');
const { verifyToken, requireOwnId } = require('../middleware/authMiddleware');
const { validateAllergens } = require('../middleware/allergenValidation');

// GET /api/allergens/user/:userId  → this customer's allergens, split standard vs custom
router.get('/user/:userId', verifyToken, requireOwnId('userId'), allergenController.getUserAllergens);

// PUT /api/allergens/user/:userId  → replace the whole set (empty arrays clear it)
router.put(
  '/user/:userId',
  verifyToken,
  requireOwnId('userId'),
  validateAllergens,
  allergenController.replaceUserAllergens
);

module.exports = router;
