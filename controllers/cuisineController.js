const CuisineModel = require('../models/cuisineModel');

class CuisineController {
  static async getUserCuisines(req, res, next) {
    try {
      const { userId } = req.params;
      const rows = await CuisineModel.getUserCuisines(parseInt(userId));

      res.json({
        success: true,
        data: {
          user_id: parseInt(userId),
          cuisines: rows.map(function (row) { return row.cuisineName; })
        }
      });
    } catch (error) {
      console.error('Error in getUserCuisines:', error);
      next(error);
    }
  }

  static async replaceUserCuisines(req, res, next) {
    try {
      const { userId } = req.params;
      const { cuisines } = req.body;

      await CuisineModel.replaceUserCuisines(parseInt(userId), cuisines);

      res.json({
        success: true,
        message: cuisines.length === 0 ? 'Palette cleared' : 'Palette saved',
        data: {
          user_id: parseInt(userId),
          cuisines: cuisines
        }
      });
    } catch (error) {
      console.error('Error in replaceUserCuisines:', error);
      next(error);
    }
  }
}

module.exports = CuisineController;
