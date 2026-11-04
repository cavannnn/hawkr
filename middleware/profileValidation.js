const Joi = require('joi');

const updateProfileSchema = Joi.object({
  UserName: Joi.string().trim().min(3).max(50).required(),
  Email: Joi.string().trim().email().max(100).allow('', null),
  PhoneNumber: Joi.string().trim().pattern(/^[0-9+\-\s()]{6,20}$/).allow('', null)
    .messages({ 'string.pattern.base': 'Phone number contains invalid characters' }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
    .messages({ 'string.min': 'New password must be at least 8 characters' }),
  confirmPassword: Joi.any().valid(Joi.ref('newPassword')).required()
    .messages({ 'any.only': 'Passwords do not match' }),
});

const assignmentsSchema = Joi.object({
  hawkerIds: Joi.array().items(Joi.number().integer()).required(),
});

function validateUpdateProfile(req, res, next) {
  const { error, value } = updateProfileSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  req.body = value;
  next();
}

function validateChangePassword(req, res, next) {
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  req.body = value;
  next();
}

function validateAssignments(req, res, next) {
  const { error, value } = assignmentsSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  req.body = value;
  next();
}

module.exports = { validateUpdateProfile, validateChangePassword, validateAssignments };
