const express = require('express');
const router = express.Router();

const profileController = require('../controllers/profileController');
const { handleProfilePhotoUpload } = require('../middleware/profileUpload');
const { validateUpdateProfile, validateChangePassword, validateAssignments } = require('../middleware/profileValidation');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// Account details — any logged-in user
router.get('/', verifyToken, profileController.getProfile);
router.put('/', verifyToken, validateUpdateProfile, profileController.updateProfile);
router.post('/photo', verifyToken, handleProfilePhotoUpload, profileController.uploadPhoto);
router.post('/change-password', verifyToken, validateChangePassword, profileController.changePassword);
router.delete('/', verifyToken, profileController.deleteAccount);

// Hawker centre self-assignment — operator only
router.get('/centres/all', verifyToken, requireRole('operator'), profileController.getAllCentres);
router.get('/centres/mine', verifyToken, requireRole('operator'), profileController.getMyCentres);
router.put('/centres', verifyToken, requireRole('operator'), validateAssignments, profileController.updateAssignments);

module.exports = router;
