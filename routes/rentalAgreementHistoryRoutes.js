const express = require('express');
const router = express.Router();

const rentalAgreementHistoryController = require('../controllers/rentalAgreementHistoryController');

router.get('/', rentalAgreementHistoryController.getAllHistory);
router.get('/:id', rentalAgreementHistoryController.getHistoryById);

module.exports = router;
