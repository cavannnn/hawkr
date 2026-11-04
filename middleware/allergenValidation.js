/* allergenValidation.js — Joi guard for the allergen profile. */
const Joi = require('joi');
const { ALLERGEN_IDS } = require('../config/allergens');

const replaceSchema = Joi.object({
  allergens: Joi.array()
    .items(Joi.string().valid(...ALLERGEN_IDS))
    .required()
    .messages({
      'any.only': `allergens must be from: ${ALLERGEN_IDS.join(', ')}`
    }),
  // Free text, so bounded rather than enumerated. 50 matches allergenName NVARCHAR(50).
  customAllergens: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .required()
});

function validateAllergens(req, res, next) {
  const { error } = replaceSchema.validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.details[0].message
    });
  }

  next();
}

module.exports = { validateAllergens };
