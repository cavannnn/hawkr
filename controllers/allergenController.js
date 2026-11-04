/* allergenController.js — a customer's saved allergens. */
const AllergenModel = require('../models/allergenModel');
const { isStandardAllergen } = require('../config/allergens');

class AllergenController {
  static async getUserAllergens(req, res, next) {
    try {
      const { userId } = req.params;
      const rows = await AllergenModel.getUserAllergens(parseInt(userId));

      const allergens = [];
      const customAllergens = [];
      rows.forEach(function (row) {
        if (isStandardAllergen(row.allergenName)) {
          allergens.push(row.allergenName);
        } else {
          customAllergens.push(row.allergenName);
        }
      });

      res.json({
        success: true,
        data: {
          user_id: parseInt(userId),
          allergens: allergens,
          customAllergens: customAllergens
        }
      });
    } catch (error) {
      console.error('Error in getUserAllergens:', error);
      next(error);
    }
  }

  static async replaceUserAllergens(req, res, next) {
    try {
      const { userId } = req.params;
      const { allergens, customAllergens } = req.body;

      // Stored as one flat set — the split on read is derived, so there is nothing to
      // preserve here beyond the names themselves.
      const names = allergens.concat(customAllergens);

      const unique = Array.from(new Set(names));

      await AllergenModel.replaceUserAllergens(parseInt(userId), unique);

      res.json({
        success: true,
        message: unique.length === 0 ? 'Allergens cleared' : 'Allergens saved',
        data: {
          user_id: parseInt(userId),
          allergens: allergens,
          customAllergens: customAllergens
        }
      });
    } catch (error) {
      console.error('Error in replaceUserAllergens:', error);
      next(error);
    }
  }
}

module.exports = AllergenController;
