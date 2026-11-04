/* cuisineValidation.js — Joi guard for My Palette. */
const Joi = require('joi');
const { CUISINE_NAMES, MAX_CUISINES } = require('../config/cuisines');

const replaceSchema = Joi.object({
  cuisines: Joi.array()
    .items(Joi.string().valid(...CUISINE_NAMES))
    .unique()
    .max(MAX_CUISINES)
    .required()
    .messages({
      'any.only': `cuisines must be from: ${CUISINE_NAMES.join(', ')}`,
      'array.max': `You can choose up to ${MAX_CUISINES} cuisines.`,
      'array.unique': 'The same cuisine cannot be chosen twice.',
    }),
});

function validateCuisines(req, res, next) {
  const { error } = replaceSchema.validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      details: error.details[0].message,
    });
  }

  next();
}

module.exports = { validateCuisines };
