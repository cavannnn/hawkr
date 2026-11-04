const express = require('express');
const router = express.Router();
const voucherController = require('../controllers/customerVoucherController');

// POST validate a voucher code before/at checkout
router.post('/validate', voucherController.validate);

module.exports = router;
