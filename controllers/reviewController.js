const ReviewModel = require('../models/reviewModel');

class ReviewController {
    // The body says WHICH order and WHAT was said. Who said it is the token, never the body.
    static async createReview(req, res, next) {
        try {
            const { orderId, stallId, rating, comment } = req.body;

            const reviewId = await ReviewModel.create({
                order_id: orderId,
                stall_id: stallId,
                customer_id: req.user.id,
                rating,
                comment
            });

            res.status(201).json({
                success: true,
                message: 'Review submitted successfully',
                data: { review_id: reviewId, feedbackId: reviewId }
            });
        } catch (error) {
            if (error.statusCode) {
                return res.status(error.statusCode).json({ success: false, message: error.message });
            }
            next(error);
        }
    }

    static async getCustomerReviews(req, res, next) {
        try {
            const { customerId } = req.params;
            const reviews = await ReviewModel.findByCustomer(customerId);

            res.json({
                success: true,
                data: reviews
            });
        } catch (error) {
            next(error);
        }
    }

    static async getStallReviews(req, res, next) {
        try {
            const { stallId } = req.params;
            const rows = await ReviewModel.findByStall(stallId);

            res.json({
                success: true,
                data: rows.map(r => ({
                    FeedbackId: r.review_id,
                    StallId: r.stall_id,
                    UserName: r.customer_name,
                    FeedbackRating: r.rating,
                    FeedbackComment: r.comment,
                    FeedbackDateTime: r.created_at
                }))
            });
        } catch (error) {
            next(error);
        }
    }

    static async getOrderReviews(req, res, next) {
        try {
            const { orderId } = req.params;
            const customerId = req.user.id;
            const rows = await ReviewModel.findByOrderForCustomer(orderId, customerId);

            res.json({ success: true, data: rows });
        } catch (error) {
            next(error);
        }
    }

    // Owner comes from the token, never the body — a body id could name anyone's review.
    static async updateReview(req, res, next) {
        try {
            const { reviewId } = req.params;
            const customerId = req.user.id;
            const { rating, comment } = req.body;

            const updated = await ReviewModel.updateOwn(reviewId, customerId, { rating, comment });

            // Not-yours answers the same as not-found, so ids can't be probed.
            if (!updated) {
                return res.status(404).json({ success: false, message: 'Review not found' });
            }

            res.json({
                success: true,
                message: 'Review updated',
                data: { review_id: Number(reviewId), rating: rating, comment: comment || null }
            });
        } catch (error) {
            if (error.statusCode) {
                return res.status(error.statusCode).json({ success: false, message: error.message });
            }
            next(error);
        }
    }

    static async deleteReview(req, res, next) {
        try {
            const { reviewId } = req.params;
            const customerId = req.user.id;

            const deleted = await ReviewModel.deleteOwn(reviewId, customerId);

            if (!deleted) {
                return res.status(404).json({ success: false, message: 'Review not found' });
            }

            res.json({ success: true, message: 'Review deleted' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = ReviewController;
