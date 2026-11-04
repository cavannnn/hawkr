const Joi = require('joi');

// Validate order creation
function validateOrder(req, res, next) {
    const schema = Joi.object({
        stall_id: Joi.number().integer().required(),
        hawker_id: Joi.number().integer().required(),
        customer_id: Joi.number().integer().positive(),
        customer_name: Joi.string().min(2).max(100).required(),
        customer_phone: Joi.string().pattern(/^[0-9]{8,12}$/).allow(null, ''),
        payment_method: Joi.string().valid('cash', 'nets', 'paynow', 'card').default('cash'),
        special_instructions: Joi.string().max(500).allow(null, ''),
        voucher_code: Joi.string().max(30).allow(null, ''),
        round_up: Joi.number().min(0).max(1).default(0),
        items: Joi.array().items(
            Joi.object({
                menu_id: Joi.number().integer().required(),
                quantity: Joi.number().integer().min(1).required(),
                special_requests: Joi.string().max(500).allow(null, '')
            })
        ).min(1).required()
    });

    // Log what's being validated
    console.log('Validating order data:', JSON.stringify(req.body, null, 2));
    
    const { error } = schema.validate(req.body);
    
    if (error) {
        console.error('Validation error details:', error.details[0].message);
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            details: error.details[0].message
        });
    }

    next();
}

// Validate order status update
function validateOrderStatus(req, res, next) {
    const schema = Joi.object({
        order_status: Joi.string().valid('pending', 'preparing', 'ready', 'completed', 'cancelled').required()
    });

    const { error } = schema.validate(req.body);
    
    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            details: error.details[0].message
        });
    }

    next();
}

// Validate customer profile update
function validateCustomerProfile(req, res, next) {
    const schema = Joi.object({
        full_name: Joi.string().min(2).max(100).optional(),
        phone: Joi.string().pattern(/^[0-9]{8,12}$/).optional(),
        email: Joi.string().email().optional()
    }).min(1);

    const { error } = schema.validate(req.body);
    
    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            details: error.details[0].message
        });
    }

    next();
}

// Validate hawker search/filter
function validateQueryParams(req, res, next) {
    const schema = Joi.object({
        hawker_id: Joi.number().integer().positive().optional(),
        stall_id: Joi.number().integer().positive().optional(),  // Added
        customer_name: Joi.string().min(1).max(100).optional(),
        limit: Joi.number().integer().min(1).max(100).default(50),
        offset: Joi.number().integer().min(0).default(0)
    });

    const { error } = schema.validate(req.query);
    
    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Invalid query parameters',
            details: error.details[0].message
        });
    }

    next();
}

function validateReview(req, res, next) {
    const schema = Joi.object({
        orderId: Joi.number().integer().positive().required(),
        stallId: Joi.number().integer().positive(),
        rating: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().max(1000).allow(null, '')
    });

    const { error } = schema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            details: error.details[0].message
        });
    }

    next();
}

// Validate a review edit — no order_id or customer_id: the order is fixed at creation and
// the identity comes from the token. Joi rejects unknown keys, so smuggling either is a 400.
function validateReviewUpdate(req, res, next) {
    const schema = Joi.object({
        rating: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().max(1000).allow(null, '')
    });

    const { error } = schema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            details: error.details[0].message
        });
    }

    next();
}

// Validate favorite toggle
function validateFavorite(req, res, next) {
    const schema = Joi.object({
        hawker_id: Joi.number().integer().positive().required(),
        stall_id: Joi.number().integer().positive().allow(null),
        menu_id: Joi.number().integer().positive().allow(null)
    });

    const { error } = schema.validate(req.body);
    
    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            details: error.details[0].message
        });
    }

    next();
}

// Validate favorite query params
function validateFavoriteQuery(req, res, next) {
    const schema = Joi.object({
        hawker_id: Joi.number().integer().positive().required(),
        stall_id: Joi.number().integer().positive().allow(null),
        menu_id: Joi.number().integer().positive().allow(null)
    });

    const { error } = schema.validate(req.query);
    
    if (error) {
        return res.status(400).json({
            success: false,
            message: 'Validation error',
            details: error.details[0].message
        });
    }

    next();
}

module.exports = {
    validateOrder,
    validateOrderStatus,
    validateCustomerProfile,
    validateQueryParams,
    validateReview,
    validateReviewUpdate,
    validateFavorite,
    validateFavoriteQuery
};
