const HawkerFeedbackModel = require('../models/hawkerFeedbackModel');

class HawkerFeedbackController {
    static async submitFeedback(req, res, next) {
        try {
            const hawkerId = Number(req.params.hawkerId);
            const customerId = req.user.id ?? req.user.UserId;
            const { rating, facility_tag, comment } = req.body;

            if (!hawkerId) {
                return res.status(400).json({ success: false, message: 'A valid hawkerId is required' });
            }
            if (rating === undefined || rating === null || facility_tag === undefined) {
                return res.status(400).json({ success: false, message: 'rating and facility_tag are required' });
            }
            if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
                return res.status(400).json({ success: false, message: 'rating must be a whole number between 1 and 5' });
            }
            if (!HawkerFeedbackModel.FACILITY_TAGS.includes(facility_tag)) {
                return res.status(400).json({
                    success: false,
                    message: `facility_tag must be one of: ${HawkerFeedbackModel.FACILITY_TAGS.join(', ')}`
                });
            }
            if (comment && comment.length > 1000) {
                return res.status(400).json({ success: false, message: 'comment must be 1000 characters or fewer' });
            }
            if (!(await HawkerFeedbackModel.hawkerExists(hawkerId))) {
                return res.status(404).json({ success: false, message: 'Hawker centre not found' });
            }

            const feedbackId = await HawkerFeedbackModel.submitFeedback({
                hawkerId,
                customerId,
                rating,
                facilityTag: facility_tag,
                comment
            });

            res.status(201).json({
                success: true,
                message: 'Feedback submitted',
                data: { feedback_id: feedbackId }
            });
        } catch (error) {
            next(error);
        }
    }

    static async getMyFeedback(req, res, next) {
        try {
            const customerId = req.user.id ?? req.user.UserId;
            const feedback = await HawkerFeedbackModel.findByCustomer(customerId);

            res.json({ success: true, data: feedback });
        } catch (error) {
            next(error);
        }
    }

    static async getFacilityTags(req, res, next) {
        try {
            res.json({ success: true, data: HawkerFeedbackModel.FACILITY_TAGS });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = HawkerFeedbackController;
