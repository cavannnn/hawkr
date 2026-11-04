/* cuisineRoutes.js — a customer's My Palette: the cuisines they like. */
const express = require('express');
const router = express.Router();
const cuisineController = require('../controllers/cuisineController');
const { verifyToken, requireOwnId } = require('../middleware/authMiddleware');
const { validateCuisines } = require('../middleware/cuisineValidation');

// GET /api/cuisines/user/:userId  → this customer's chosen cuisines
router.get('/user/:userId', verifyToken, requireOwnId('userId'), cuisineController.getUserCuisines);

// PUT /api/cuisines/user/:userId  → replace the whole palette (an empty array clears it)
router.put(
  '/user/:userId',
  verifyToken,
  requireOwnId('userId'),
  validateCuisines,
  cuisineController.replaceUserCuisines
);

module.exports = router;
