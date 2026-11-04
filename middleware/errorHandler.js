// Global error handling middleware
function errorHandler(err, req, res, next) {
    console.error('Error:', err);
    console.error('Error stack:', err.stack);

    // If it's a database error with a specific message
    if (err.message && err.message.includes('Database error')) {
        return res.status(500).json({
            success: false,
            message: err.message,
            error: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }

    if (err.message && err.message.includes('not found')) {
        return res.status(404).json({
            success: false,
            message: err.message
        });
    }

    if (err.code && err.code.startsWith('E')) {
        return res.status(500).json({
            success: false,
            message: 'Database error occurred',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
}

// 404 Not Found middleware
function notFoundHandler(req, res) {
    res.status(404).json({
        success: false,
        message: 'Route ' + req.originalUrl + ' not found'
    });
}

module.exports = {
    errorHandler,
    notFoundHandler
};
