const logger = require("../utils/logger");

// Role constants
const ROLES = {
    ADMIN: 1,
    MODERATOR: 2,
    USER: 3,
    GUEST: 4
};

const ROLE_NAMES = {
    1: "Admin",
    2: "Moderator",
    3: "User",
    4: "Guest"
};

// Role-based access control
const allowRole = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            // Check if user exists in request
            if (!req.user) {
                logger.warn(`Role check failed: No user context`);
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                    code: "NO_USER_CONTEXT",
                    timestamp: new Date().toISOString()
                });
            }

            // Get user role (support both `role` and `role_id` fields)
            const userRole = req.user.role || req.user.role_id || 0;
            const userEmail = req.user.email || "Unknown";

            // Check if role is allowed
            if (!allowedRoles.includes(userRole)) {
                const roleNames = allowedRoles.map(r => ROLE_NAMES[r] || r).join(", ");
                logger.warn(`Access denied: User ${req.user.id} (${userEmail}) with role ${userRole} tried to access route requiring [${roleNames}]`);
                
                return res.status(403).json({
                    success: false,
                    message: "Access denied. Insufficient permissions.",
                    code: "ACCESS_DENIED",
                    data: {
                        required: allowedRoles.map(r => ROLE_NAMES[r] || r),
                        current: ROLE_NAMES[userRole] || userRole
                    },
                    timestamp: new Date().toISOString()
                });
            }

            // Log successful role check
            logger.debug(`Role check passed: User ${req.user.id} (${userEmail}) with role ${userRole}`);

            // Proceed
            next();

        } catch (error) {
            logger.error(`Role middleware error: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: "Authorization error",
                code: "AUTHZ_ERROR",
                timestamp: new Date().toISOString()
            });
        }
    };
};

// --- Check if user has any of the specified roles (returns boolean) ---
const hasRole = (user, ...allowedRoles) => {
    if (!user) return false;
    const userRole = user.role || user.role_id || 0;
    return allowedRoles.includes(userRole);
};

// --- Check if user is admin ---
const isAdmin = (user) => {
    return hasRole(user, ROLES.ADMIN);
};

// --- Check if user is moderator or admin ---
const isModOrAdmin = (user) => {
    return hasRole(user, ROLES.ADMIN, ROLES.MODERATOR);
};

// --- Middleware: Check if user is accessing their own resource ---
const allowSelfOrRole = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                    code: "NO_USER_CONTEXT"
                });
            }

            const userRole = req.user.role || req.user.role_id || 0;
            const targetUserId = parseInt(req.params.userId || req.params.id || req.body.userId);

            // Allow if user has required role OR is accessing their own resource
            if (allowedRoles.includes(userRole) || (targetUserId && req.user.id === targetUserId)) {
                return next();
            }

            logger.warn(`Self/role check failed: User ${req.user.id} tried to access resource ${targetUserId}`);
            return res.status(403).json({
                success: false,
                message: "Access denied. You can only access your own resources.",
                code: "ACCESS_DENIED",
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            logger.error(`Self/role middleware error: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: "Authorization error",
                code: "AUTHZ_ERROR"
            });
        }
    };
};

module.exports = {
    allowRole,
    hasRole,
    isAdmin,
    isModOrAdmin,
    allowSelfOrRole,
    ROLES,
    ROLE_NAMES
};