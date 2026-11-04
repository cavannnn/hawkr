const express = require('express');
const router = express.Router();
const favoriteController = require('../controllers/favoriteController');
const { validateFavorite, validateFavoriteQuery } = require('../middleware/validate');

// GET all favorites for a user
router.get('/user/:userId', favoriteController.getUserFavorites);

// GET check if a specific item is favorited
router.get('/user/:userId/check', validateFavoriteQuery, favoriteController.checkFavorited);

// GET favorite counts for a hawker/stall/menu item
router.get('/counts/:hawkerId', favoriteController.getFavoriteCounts);

// POST toggle favorite
router.post('/user/:userId/toggle', validateFavorite, favoriteController.toggleFavorite);

// DELETE remove favorites
router.delete('/user/:userId', favoriteController.deleteUserFavorites);

module.exports = router;
