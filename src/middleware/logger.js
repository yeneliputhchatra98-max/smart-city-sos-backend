const logger = require("../utils/logger");

const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Log request on finish
    res.on("finish", () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? "warn" : "info";
        
        logger.log({
            level: logLevel,
            message: `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`,
            ip: req.ip || req.connection.remoteAddress,
            user: req.user?.id || "anonymous",
            userAgent: req.headers["user-agent"],
            referer: req.headers["referer"] || null
        });
    });
    
    next();
};

module.exports = { requestLogger };