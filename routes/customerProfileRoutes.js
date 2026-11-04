const express = require('express');
const router = express.Router();
const customerProfileController = require('../controllers/customerProfileController');

// GET one customer's own profile details
router.get('/:userId', customerProfileController.getProfile);

// PUT phone number only — username/email aren't editable from here
router.put('/:userId/phone', customerProfileController.updatePhone);

module.exports = router;
