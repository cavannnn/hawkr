const Joi = require('joi');

const CLOSURE_REASONS = ['Cleaning', 'Maintenance', 'Public Holiday', 'Special Event', 'Other'];

const createClosureSchema = Joi.object({
  HawkerId: Joi.number().integer().required(),
  Reason: Joi.string().valid(...CLOSURE_REASONS).required(),
  StartDateTime: Joi.date().required(),
  EndDateTime: Joi.date().greater(Joi.ref('StartDateTime')).required()
    .messages({ 'date.greater': 'EndDateTime must be after StartDateTime' }),
  Notes: Joi.string().trim().max(500).allow('', null),
});

const createPromotionSchema = Joi.object({
  HawkerId: Joi.number().integer().required(),
  Name: Joi.string().trim().min(1).max(100).required(),
  Description: Joi.string().trim().max(500).allow('', null),
  DiscountType: Joi.string().valid('Percentage', 'FixedAmount').required(),
  DiscountValue: Joi.number().positive().required(),
  StartDateTime: Joi.date().required(),
  EndDateTime: Joi.date().greater(Joi.ref('StartDateTime')).required()
    .messages({ 'date.greater': 'EndDateTime must be after StartDateTime' }),
  stallIds: Joi.alternatives().try(
    Joi.string().valid('all'),
    Joi.array().items(Joi.number().integer())
  ).required(),
});

const clonePromotionSchema = Joi.object({
  targetHawkerId: Joi.number().integer().required(),
});

function validate(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    req.body = value;
    next();
  };
}

module.exports = {
  validateCreateClosure: validate(createClosureSchema),
  validateCreatePromotion: validate(createPromotionSchema),
  validateClonePromotion: validate(clonePromotionSchema),
};
