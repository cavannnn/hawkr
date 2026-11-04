// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    req.user = { id: 1, role: 'customer' };
    next();
}

// Role-based authorization middleware
function authorize(roles = []) {
    return (req, res, next) => {
        if (roles.length === 0) {
            return next();
        }

        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        if (roles.includes(req.user.role)) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
        });
    };
}

module.exports = {
    authenticateToken,
    authorize
};
