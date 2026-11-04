const express = require('express');
const router = express.Router();

const rentalAgreementController = require('../controllers/rentalAgreementController');
const { validateCreateRentalAgreement, validateUpdateRentalAgreement } = require('../middleware/rentalAgreementValidation');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

router.get('/', rentalAgreementController.getAllRentalAgreements);
router.get('/:id', rentalAgreementController.getRentalAgreementById);
router.get('/:id/pdf', rentalAgreementController.downloadAgreementPdf);
router.post('/', verifyToken, requireRole('operator'), validateCreateRentalAgreement, rentalAgreementController.createRentalAgreement);
router.put('/:id', verifyToken, requireRole('operator'), validateUpdateRentalAgreement, rentalAgreementController.updateRentalAgreement);
router.delete('/:id', verifyToken, requireRole('operator'), rentalAgreementController.deleteRentalAgreement);

module.exports = router;