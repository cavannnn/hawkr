const Joi = require('joi');

const createSchema = Joi.object({
  StallId: Joi.number().integer().required(),
  OwnerId: Joi.number().integer().required(),
  AgreementStartDate: Joi.date().required(),
  AgreementEndDate: Joi.date().greater(Joi.ref('AgreementStartDate')).required()
    .messages({ 'date.greater': 'AgreementEndDate must be after AgreementStartDate' }),
  AgreementTermsAndConditions: Joi.string().required(),
  RentalPrice: Joi.number().positive().required(),
});

const updateSchema = Joi.object({
  AgreementId: Joi.number().integer().required(),
  StallId: Joi.number().integer().required(),
  OwnerId: Joi.number().integer().required(),
  AgreementEndDate: Joi.date().required(),
  AgreementTermsAndConditions: Joi.string().required(),
  RentalPrice: Joi.number().positive().required(),
});

function validateCreateRentalAgreement(req, res, next) {
  const { error } = createSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
}

function validateUpdateRentalAgreement(req, res, next) {
  const { error } = updateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  next();
}

module.exports = { validateCreateRentalAgreement, validateUpdateRentalAgreement };