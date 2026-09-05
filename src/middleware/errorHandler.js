const logger = require("../utils/logger");

// ===============================
// Global Error Handler
// ===============================
const errorHandler = (err, req, res, next) => {
    console.error("ERROR:", err);
    console.error("CODE:", err.code);
    console.error("STATUS:", err.statusCode);

    const statusCode = err.statusCode || 500;

    const message =
        err.message || "Internal Server Error";

    logger.error(`Error: ${message}`, {
        statusCode,
        path: req.path,
        method: req.method,
        ip: req.ip || req.connection?.remoteAddress,
        user: req.user?.id || "anonymous",
        stack: err.stack
    });

    return res.status(statusCode).json({
        success: false,
        message,
        code: err.code || "INTERNAL_ERROR",
        ...(process.env.NODE_ENV === "development" && {
            stack: err.stack
        }),
        timestamp: new Date().toISOString()
    });
};

// ===============================
// App Error
// ===============================
class AppError extends Error {
    constructor(
        message,
        statusCode = 500,
        code = "INTERNAL_ERROR"
    ) {
        super(message);

        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;

        Error.captureStackTrace(
            this,
            this.constructor
        );
    }
}

// ===============================
// Other Error Classes
// ===============================

class ValidationError extends AppError {
    constructor(
        message,
        code = "VALIDATION_ERROR"
    ) {
        super(message, 400, code);
    }
}

class NotFoundError extends AppError {
    constructor(
        message = "Resource not found",
        code = "NOT_FOUND"
    ) {
        super(message, 404, code);
    }
}

class UnauthorizedError extends AppError {
    constructor(
        message = "Unauthorized",
        code = "UNAUTHORIZED"
    ) {
        super(message, 401, code);
    }
}

class ForbiddenError extends AppError {
    constructor(
        message = "Forbidden",
        code = "FORBIDDEN"
    ) {
        super(message, 403, code);
    }
}

class ConflictError extends AppError {
    constructor(
        message = "Resource conflict",
        code = "CONFLICT"
    ) {
        super(message, 409, code);
    }
}

// ===============================
// Export
// ===============================

module.exports = {
    errorHandler,
    AppError,
    ValidationError,
    NotFoundError,
    UnauthorizedError,
    ForbiddenError,
    ConflictError
};