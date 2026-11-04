const Joi = require('joi');

const CATEGORIES = [
  'Facility Issue', 'Cleanliness', 'Account Issue', 'Billing/Rental',
  'Order/Payment', 'Queue/Crowd', 'Safety Concern', 'Others',
];

const IN_FLIGHT_STATUSES = ['In Progress', 'Finding Solution', 'Testing', 'Awaiting Response'];

const createTicketSchema = Joi.object({
  HawkerId: Joi.number().integer().required(),
  Category: Joi.string().valid(...CATEGORIES).required(),
  OtherCategoryText: Joi.string().trim().min(1).when('Category', {
    is: 'Others',
    then: Joi.required(),
    otherwise: Joi.optional().allow('', null),
  }),
  Subject: Joi.string().trim().min(1).max(150).required(),
  Description: Joi.string().trim().min(1).required(),
});

const statusUpdateSchema = Joi.object({
  Status: Joi.string().valid(...IN_FLIGHT_STATUSES).required(),
});

const completeTicketSchema = Joi.object({
  Outcome: Joi.string().valid('Completed', 'Unresolvable').required(),
  Message: Joi.string().trim().min(1).required(),
});

function validateCreateTicket(req, res, next) {
  const { error, value } = createTicketSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  req.body = value;
  next();
}

function validateStatusUpdate(req, res, next) {
  const { error, value } = statusUpdateSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  req.body = value;
  next();
}

function validateCompleteTicket(req, res, next) {
  const { error, value } = completeTicketSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  req.body = value;
  next();
}

module.exports = {
  CATEGORIES,
  IN_FLIGHT_STATUSES,
  validateCreateTicket,
  validateStatusUpdate,
  validateCompleteTicket,
};
