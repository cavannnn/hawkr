const HawkerModel = require('../models/hawkerModel');

class HawkerController {
    static async getAllHawkers(req, res, next) {
        try {
            const hawkers = await HawkerModel.findAll();
            
            res.json({
                success: true,
                data: hawkers
            });
        } catch (error) {
            next(error);
        }
    }

    static async getHawkerById(req, res, next) {
        try {
            const { hawkerId } = req.params;
            const hawker = await HawkerModel.findById(hawkerId);
            
            if (!hawker) {
                return res.status(404).json({
                    success: false,
                    message: 'Hawker centre not found'
                });
            }

            res.json({
                success: true,
                data: hawker
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = HawkerController;
