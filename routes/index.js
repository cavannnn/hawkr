const express = require('express');
const router = express.Router();

// Import route modules
const hawkerRoutes = require('./hawkerRoutes');
const stallRoutes = require('./customerStallRoutes');
const menuRoutes = require('./menuRoutes');
const orderRoutes = require('./orderRoutes');
const favoriteRoutes = require('./favoriteRoutes');
const voucherRoutes = require('./voucherRoutes');
const customerProfileRoutes = require('./customerProfileRoutes');
const reviewRoutes = require('./reviewRoutes');
const allergenRoutes = require('./allergenRoutes');
const cuisineRoutes = require('./cuisineRoutes');

// Mount routes
router.use('/hawkers', hawkerRoutes);
router.use('/stalls', stallRoutes);
router.use('/menu', menuRoutes);
router.use('/orders', orderRoutes);
router.use('/favorites', favoriteRoutes);
router.use('/vouchers', voucherRoutes);
router.use('/customers', customerProfileRoutes);
router.use('/reviews', reviewRoutes);
router.use('/feedback', reviewRoutes);
router.use('/allergens', allergenRoutes);
router.use('/cuisines', cuisineRoutes);

module.exports = router;
