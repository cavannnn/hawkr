const MenuModel = require('../models/menuModel');

class MenuController {
    static async getMenuByStall(req, res, next) {
        try {
            const { stallId } = req.params;
            const { hawker_id } = req.query;
            
            if (!stallId || isNaN(parseInt(stallId))) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid stall ID provided'
                });
            }
            
            const menu = await MenuModel.findByStallId(
                parseInt(stallId), 
                hawker_id ? parseInt(hawker_id) : null
            );
            
            res.json({
                success: true,
                data: menu || []
            });
        } catch (error) {
            console.error('Error in getMenuByStall:', error.message);
            
            // Check if it's a database error
            if (error.message.includes('Database error')) {
                return res.status(500).json({
                    success: false,
                    message: 'Database error occurred',
                    error: error.message
                });
            }
            
            next(error);
        }
    }
}

module.exports = MenuController;