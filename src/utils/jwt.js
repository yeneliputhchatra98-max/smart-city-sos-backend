const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const logger = require("./logger");

// ==================== CONFIGURATION ====================

// Load secrets from environment with secure fallbacks
const JWT_SECRET = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;

// Validate secrets in production
if (process.env.NODE_ENV === 'production') {
    if (!JWT_SECRET || JWT_SECRET === "your-super-secret-jwt-key-change-this-now") {
        throw new Error("JWT_SECRET must be set in production environment");
    }
    if (!REFRESH_SECRET || REFRESH_SECRET === "your-refresh-secret-change-this-now") {
        throw new Error("REFRESH_SECRET must be set in production environment");
    }
}

// Use fallbacks only in development
const getJwtSecret = () => {
    if (process.env.NODE_ENV === 'production') {
        return JWT_SECRET;
    }
    return JWT_SECRET || "dev-jwt-secret-do-not-use-in-production";
};

const getRefreshSecret = () => {
    if (process.env.NODE_ENV === 'production') {
        return REFRESH_SECRET;
    }
    return REFRESH_SECRET || "dev-refresh-secret-do-not-use-in-production";
};

const JWT_ISSUER = process.env.JWT_ISSUER || "heang-black-cyber";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || "galactic-explorers";

// Token types
const TOKEN_TYPES = {
    ACCESS: "access",
    REFRESH: "refresh",
    VERIFY: "verify",
    RESET: "reset"
};

// ==================== TOKEN GENERATORS ====================

/**
 * Generate Access Token (short-lived)
 * @param {Object} user - User data
 * @param {number|string} user.id - User ID
 * @param {string} user.role - User role
 * @param {string} user.email - User email
 * @returns {string} JWT access token
 */
const generateToken = (user) => {
    try {
        if (!user || (!user.uid && !user.id)) {
            throw new Error("Invalid user data for token generation");
        }

        const payload = {
            id: user.uid || user.id,
            role: user.role || "CITIZEN",
            email: user.email || null,
            type: TOKEN_TYPES.ACCESS
        };

        // Add fullName if available
        if (user.fullName) {
            payload.fullName = user.fullName;
        }

        return jwt.sign(
            payload,
            getJwtSecret(),
            {
                expiresIn: process.env.JWT_EXPIRY || "1d",
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
                algorithm: "HS256"
            }
        );
    } catch (error) {
        logger.error(`Generate access token error: ${error.message}`);
        throw error;
    }
};

/**
 * Generate Refresh Token (long-lived)
 * @param {Object} user - User data
 * @param {number|string} user.id - User ID
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (user) => {
    try {
        if (!user || (!user.uid && !user.id)) {
            throw new Error("Invalid user data for refresh token");
        }

        return jwt.sign(
            {
                id: user.uid || user.id,
                type: TOKEN_TYPES.REFRESH,
                fingerprint: crypto.randomBytes(16).toString("hex"),
                issuedAt: Date.now()
            },
            getRefreshSecret(),
            {
                expiresIn: process.env.REFRESH_EXPIRY || "7d",
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
                algorithm: "HS256"
            }
        );
    } catch (error) {
        logger.error(`Generate refresh token error: ${error.message}`);
        throw error;
    }
};

/**
 * Generate Email Verification Token
 * @param {string} email - User email
 * @returns {string} JWT verification token
 */
const generateVerifyToken = (email) => {
    try {
        if (!email || !email.includes('@')) {
            throw new Error("Invalid email for verification token");
        }

        return jwt.sign(
            {
                email: email,
                type: TOKEN_TYPES.VERIFY,
                purpose: "email_verification"
            },
            getJwtSecret(),
            {
                expiresIn: "24h",
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE
            }
        );
    } catch (error) {
        logger.error(`Generate verify token error: ${error.message}`);
        throw error;
    }
};

/**
 * Generate Password Reset Token
 * @param {number|string} userId - User ID
 * @returns {string} JWT reset token
 */
const generateResetToken = (userId) => {
    try {
        if (!userId) {
            throw new Error("User ID required for reset token");
        }

        return jwt.sign(
            {
                id: userId,
                type: TOKEN_TYPES.RESET,
                purpose: "password_reset"
            },
            getJwtSecret(),
            {
                expiresIn: "1h",
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE
            }
        );
    } catch (error) {
        logger.error(`Generate reset token error: ${error.message}`);
        throw error;
    }
};

// ==================== TOKEN VERIFIERS ====================

/**
 * Verify any token with proper error handling
 * @param {string} token - JWT token
 * @param {string} secret - Secret key (optional)
 * @returns {Object} Verification result
 */
const verifyToken = (token, secret = null) => {
    try {
        if (!token) {
            throw new Error("Token is required");
        }

        // Remove "Bearer " prefix if present
        const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;

        const decoded = jwt.verify(
            cleanToken,
            secret || getJwtSecret(),
            {
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE
            }
        );

        return {
            valid: true,
            decoded,
            expired: false
        };
    } catch (error) {
        let errorType = "invalid";

        if (error.name === "TokenExpiredError") {
            errorType = "expired";
        } else if (error.name === "JsonWebTokenError") {
            errorType = "malformed";
        } else if (error.name === "NotBeforeError") {
            errorType = "not_before";
        }

        return {
            valid: false,
            error: error.message,
            type: errorType
        };
    }
};

/**
 * Verify Access Token
 * @param {string} token - JWT access token
 * @returns {Object} Verification result
 */
const verifyAccessToken = (token) => {
    try {
        const result = verifyToken(token, getJwtSecret());
        if (result.valid && result.decoded.type !== TOKEN_TYPES.ACCESS) {
            return { 
                valid: false, 
                error: "Invalid token type - expected access token",
                type: "invalid_type"
            };
        }
        return result;
    } catch (error) {
        logger.error(`Verify access token error: ${error.message}`);
        return { valid: false, error: error.message, type: "invalid" };
    }
};

/**
 * Verify Refresh Token
 * @param {string} token - JWT refresh token
 * @returns {Object} Verification result
 */
const verifyRefreshToken = (token) => {
    try {
        const result = verifyToken(token, getRefreshSecret());
        if (result.valid && result.decoded.type !== TOKEN_TYPES.REFRESH) {
            return { 
                valid: false, 
                error: "Invalid token type - expected refresh token",
                type: "invalid_type"
            };
        }
        return result;
    } catch (error) {
        logger.error(`Verify refresh token error: ${error.message}`);
        return { valid: false, error: error.message, type: "invalid" };
    }
};

/**
 * Verify Email Verification Token
 * @param {string} token - JWT verification token
 * @returns {Object} Verification result
 */
const verifyVerifyToken = (token) => {
    try {
        const result = verifyToken(token, getJwtSecret());
        if (result.valid && result.decoded.type !== TOKEN_TYPES.VERIFY) {
            return { 
                valid: false, 
                error: "Invalid token type - expected verification token",
                type: "invalid_type"
            };
        }
        return result;
    } catch (error) {
        logger.error(`Verify verification token error: ${error.message}`);
        return { valid: false, error: error.message, type: "invalid" };
    }
};

/**
 * Verify Password Reset Token
 * @param {string} token - JWT reset token
 * @returns {Object} Verification result
 */
const verifyResetToken = (token) => {
    try {
        const result = verifyToken(token, getJwtSecret());
        if (result.valid && result.decoded.type !== TOKEN_TYPES.RESET) {
            return { 
                valid: false, 
                error: "Invalid token type - expected reset token",
                type: "invalid_type"
            };
        }
        return result;
    } catch (error) {
        logger.error(`Verify reset token error: ${error.message}`);
        return { valid: false, error: error.message, type: "invalid" };
    }
};

// ==================== TOKEN UTILITIES ====================

/**
 * Decode without verification (for debugging only)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token payload
 */
const decodeToken = (token) => {
    try {
        if (!token) return null;
        const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
        return jwt.decode(cleanToken);
    } catch (error) {
        logger.warn(`Decode token error: ${error.message}`);
        return null;
    }
};

/**
 * Check if token is about to expire
 * @param {string} token - JWT token
 * @param {number} thresholdSeconds - Threshold in seconds (default: 300)
 * @returns {boolean} True if token is expiring soon
 */
const isTokenExpiringSoon = (token, thresholdSeconds = 300) => {
    try {
        if (!token) return true;
        const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
        const decoded = jwt.decode(cleanToken);
        
        if (!decoded || !decoded.exp) return true;

        const now = Math.floor(Date.now() / 1000);
        const timeLeft = decoded.exp - now;

        return timeLeft < thresholdSeconds;
    } catch (error) {
        logger.warn(`Check token expiry error: ${error.message}`);
        return true;
    }
};

/**
 * Get remaining time on token
 * @param {string} token - JWT token
 * @returns {number} Remaining time in seconds
 */
const getTokenRemainingTime = (token) => {
    try {
        if (!token) return 0;
        const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
        const decoded = jwt.decode(cleanToken);
        
        if (!decoded || !decoded.exp) return 0;
        
        const now = Math.floor(Date.now() / 1000);
        return Math.max(0, decoded.exp - now);
    } catch (error) {
        logger.warn(`Get token remaining time error: ${error.message}`);
        return 0;
    }
};

// ==================== TOKEN BLACKLIST ====================

// In-memory blacklist (for development only - use Redis in production)
const blacklistCache = new Map();

/**
 * Blacklist a token
 * @param {string} token - JWT token
 * @param {number} expiry - Expiry time in seconds
 * @returns {Promise<boolean>} Success
 */
const blacklistToken = async (token, expiry = 86400) => {
    try {
        if (!token) throw new Error("Token required for blacklist");
        
        const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
        
        // For production, use Redis:
        // await redis.setex(`blacklist:${cleanToken}`, expiry, "1");
        
        // In-memory implementation (development only)
        blacklistCache.set(cleanToken, {
            blacklistedAt: Date.now(),
            expiresAt: Date.now() + (expiry * 1000)
        });
        
        // Auto cleanup old entries
        setTimeout(() => {
            blacklistCache.delete(cleanToken);
        }, expiry * 1000);
        
        logger.info(`Token blacklisted: ${cleanToken.substring(0, 20)}...`);
        return true;
    } catch (error) {
        logger.error(`Blacklist token error: ${error.message}`);
        return false;
    }
};

/**
 * Check if token is blacklisted
 * @param {string} token - JWT token
 * @returns {Promise<boolean>} True if blacklisted
 */
const isTokenBlacklisted = async (token) => {
    try {
        if (!token) return false;
        
        const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
        
        // For production, use Redis:
        // const blacklisted = await redis.get(`blacklist:${cleanToken}`);
        // return blacklisted !== null;
        
        // In-memory implementation (development only)
        const entry = blacklistCache.get(cleanToken);
        if (!entry) return false;
        
        // Check if expired
        if (Date.now() > entry.expiresAt) {
            blacklistCache.delete(cleanToken);
            return false;
        }
        
        return true;
    } catch (error) {
        logger.error(`Check blacklist error: ${error.message}`);
        return false;
    }
};

// ==================== EXPRESS MIDDLEWARE ====================

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to req.user
 */
const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                success: false,
                message: "No token provided",
                code: "NO_TOKEN"
            });
        }

        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
        
        // Check if token is blacklisted
        const blacklisted = await isTokenBlacklisted(token);
        if (blacklisted) {
            return res.status(401).json({
                success: false,
                message: "Token has been revoked",
                code: "TOKEN_REVOKED"
            });
        }

        const result = verifyAccessToken(token);

        if (!result.valid) {
            const status = result.type === "expired" ? 401 : 403;
            const message = result.type === "expired" ? "Token expired" : "Invalid token";
            
            return res.status(status).json({
                success: false,
                message: message,
                code: result.type.toUpperCase()
            });
        }

        // Attach user to request
        req.user = result.decoded;
        req.token = token;
        
        next();
    } catch (error) {
        logger.error(`Auth middleware error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Authentication error",
            code: "AUTH_ERROR"
        });
    }
};

/**
 * Role-based middleware
 * @param {Array<string>} allowedRoles - List of allowed roles
 * @returns {Function} Middleware function
 */
const roleMiddleware = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized - No user context",
                    code: "NO_USER_CONTEXT"
                });
            }

            // Check if user has required role
            if (!allowedRoles.includes(req.user.role)) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden - Insufficient permissions",
                    code: "INSUFFICIENT_PERMISSIONS",
                    required: allowedRoles,
                    current: req.user.role
                });
            }

            next();
        } catch (error) {
            logger.error(`Role middleware error: ${error.message}`);
            return res.status(500).json({
                success: false,
                message: "Authorization error",
                code: "AUTHZ_ERROR"
            });
        }
    };
};

/**
 * Optional authentication middleware
 * Tries to authenticate but continues even if no token
 */
const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (authHeader) {
            const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
            const result = verifyAccessToken(token);
            
            if (result.valid) {
                req.user = result.decoded;
                req.token = token;
            }
        }

        next();
    } catch (error) {
        // Continue without user
        next();
    }
};

// ==================== EXPORT ====================

module.exports = {
    // Generators
    generateToken,
    generateRefreshToken,
    generateVerifyToken,
    generateResetToken,

    // Verifiers
    verifyToken,
    verifyAccessToken,
    verifyRefreshToken,
    verifyVerifyToken,
    verifyResetToken,

    // Utilities
    decodeToken,
    isTokenExpiringSoon,
    getTokenRemainingTime,
    blacklistToken,
    isTokenBlacklisted,

    // Middleware
    authMiddleware,
    roleMiddleware,
    optionalAuthMiddleware,

    // Constants
    TOKEN_TYPES
};