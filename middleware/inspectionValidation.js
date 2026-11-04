const Joi = require('joi');

const MAX_REMARKS = 1000;

function toLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

const inspectionDate = Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .custom((value, helpers) => {
        const parsed = new Date(`${value}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) {
            return helpers.message('Please enter a valid date.');
        }
        if (value < toLocalDateString()) {
            return helpers.message('Inspection date cannot be in the past.');
        }
        return value;
    })
    .messages({
        'string.pattern.base': 'Please enter a valid date.',
        'string.empty': 'Inspection date is required.',
        'any.required': 'Inspection date is required.'
    });

const createInspectionSchema = Joi.object({
    stallId: Joi.number().integer().positive().required().messages({
        'number.base': 'Please select a valid stall.',
        'number.integer': 'Please select a valid stall.',
        'number.positive': 'Please select a valid stall.',
        'any.required': 'Stall is required.'
    }),
    date: inspectionDate
});

const updateScheduleSchema = Joi.object({
    date: inspectionDate
});

const assessmentSchema = Joi.object({
    hygieneScore: Joi.number().integer().min(1).max(5).required().messages({
        'number.base': 'Hygiene score must be a number.',
        'number.integer': 'Hygiene score must be a whole number.',
        'number.min': 'Hygiene score must be at least 1.',
        'number.max': 'Hygiene score must be at most 5.',
        'any.required': 'Hygiene score is required.'
    }),
    personalHygiene: Joi.boolean().required().messages({
        'any.required': 'Personal hygiene assessment is required.'
    }),
    foodStorage: Joi.boolean().required().messages({
        'any.required': 'Food storage assessment is required.'
    }),
    pestControl: Joi.boolean().required().messages({
        'any.required': 'Pest control assessment is required.'
    }),
    isMajorIssue: Joi.boolean().required().messages({
        'any.required': 'Major issue flag is required.'
    }),
    remarks: Joi.string().allow('').max(MAX_REMARKS).when('isMajorIssue', {
        is: true,
        then: Joi.string().trim().min(1).max(MAX_REMARKS).required().messages({
            'string.empty': 'Remarks are required when major issues are found.',
            'string.min': 'Remarks are required when major issues are found.',
            'any.required': 'Remarks are required when major issues are found.'
        })
    }).messages({
        'string.max': `Remarks cannot be longer than ${MAX_REMARKS} characters.`
    })
});

const validateInspection = (req, res, next) => {
    const { error } = createInspectionSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details[0].message });
    next();
};

const validateUpdateSchedule = (req, res, next) => {
    const { error } = updateScheduleSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details[0].message });
    next();
};

const validateAssessment = (req, res, next) => {
    const { error } = assessmentSchema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ error: error.details[0].message });
    next();
};

const validateNumericParam = (paramName, label = 'id') => (req, res, next) => {
    const value = Number(req.params[paramName]);
    if (!Number.isInteger(value) || value < 1) {
        return res.status(400).json({ error: `Invalid ${label}.` });
    }
    next();
};

module.exports = {
    validateInspection,
    validateUpdateSchedule,
    validateAssessment,
    validateNumericParam,
    toLocalDateString
};
