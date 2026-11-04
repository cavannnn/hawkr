const StallModel = require('../models/customerStallModel');
const PromotionModel = require('../models/promotionModel');

class StallController {
    static async getStallPromotions(req, res, next) {
        try {
            const stallId = Number(req.params.stallId);
            if (!stallId) {
                return res.status(400).json({ success: false, message: 'A valid stallId is required' });
            }

            const promotions = await PromotionModel.getActivePromotionsForStall(stallId);

            res.json({
                success: true,
                stallId: stallId,
                promotions: promotions.map(p => ({
                    promotionId: p.promotionId,
                    name: p.name,
                    description: p.description,
                    discountType: p.discountType,
                    discountValue: Number(p.discountValue),
                    scopeType: p.scopeType,
                    scopeCategory: p.scopeCategory,
                    scopeMenuIds: p.scopeMenuIds || [],
                    isActive: !!p.isActive,
                    startDate: p.startDate,
                    endDate: p.endDate
                }))
            });
        } catch (error) {
            next(error);
        }
    }

    static async getAllStalls(req, res, next) {
        try {
            const { hawker_id } = req.query;
            const stalls = await StallModel.findAll({ hawker_id });
            
            res.json({
                success: true,
                data: stalls
            });
        } catch (error) {
            next(error);
        }
    }

    static async getStallById(req, res, next) {
        try {
            const { stallId } = req.params;
            const { hawker_id } = req.query;
            
            const stall = await StallModel.findById(stallId, hawker_id);
            
            if (!stall) {
                return res.status(404).json({
                    success: false,
                    message: 'Stall not found'
                });
            }

            res.json({
                success: true,
                data: stall
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = StallController;