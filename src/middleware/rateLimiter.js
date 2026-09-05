const rateLimit = require("express-rate-limit");

const rateLimiter = (max, windowMs = 60 * 1000) => {
    return rateLimit({
        windowMs,
        max,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            success: false,
            message: `Too many requests, please try again after ${windowMs / 1000} seconds`,
            code: "RATE_LIMITED",
            timestamp: new Date().toISOString()
        },
        skip: (req) => {
            // Skip rate limiting for health checks
            return req.path === "/health" || req.path === "/ping";
        }
    });
};

module.exports = { rateLimiter };