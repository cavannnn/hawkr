const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');

// GET menu by stall ID
router.get('/stall/:stallId', menuController.getMenuByStall);

module.exports = router;
