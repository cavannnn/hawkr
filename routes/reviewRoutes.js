const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { validateReview, validateReviewUpdate } = require('../middleware/validate');
const { verifyToken } = require('../middleware/authMiddleware');

// POST create a review for any order that was not cancelled — see REVIEWABLE_STATUSES in
// models/reviewModel.js. verifyToken is what makes
// the review's author knowable: the model checks the order belongs to the CALLER, so without
// a token there is nobody for that check to be about and any customer id in the body would
// be taken on trust.
router.post('/', verifyToken, validateReview, reviewController.createReview);

// Reviews for a stall are vendor-only (see /vendor/:id/stalls/:stallId/reviews) so
// customers never see each other's feedback — no public "list reviews by stall" route here.

// GET the public review list shown on a stall's profile page — no token, anyone can read
router.get('/stall/:stallId', reviewController.getStallReviews);

// GET your own reviews for one order, so the review screen knows which stalls are done
router.get('/order/:orderId', verifyToken, reviewController.getOrderReviews);

// GET all reviews a customer has written (used to know which of their orders are already reviewed)
router.get('/customer/:customerId', reviewController.getCustomerReviews);

// PUT edit your own review — rating and comment only, owner taken from the token
router.put('/:reviewId', verifyToken, validateReviewUpdate, reviewController.updateReview);

// DELETE a customer's own review
router.delete('/:reviewId', verifyToken, reviewController.deleteReview);

module.exports = router;
