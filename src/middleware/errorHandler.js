const logger = require("../utils/logger");

// ===============================
// Global Error Handler
// ===============================
const errorHandler = (err, req, res, next) => {
    // ✅ Default values
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || "Internal Server Error";
    let code = err.code || "INTERNAL_ERROR";

    // ✅ Handle Prisma errors
    if (err.code === "P2002") {
        statusCode = 409;
        const target = err.meta?.target;
        message = `Duplicate value${
            Array.isArray(target) ? ` on: ${target.join(", ")}` : ""
        }`;
        code = "DUPLICATE_VALUE";
    } else if (err.code === "P2025") {
        statusCode = 404;
        message = "Record not found";
        code = "NOT_FOUND";
    } else if (err.code === "P2003") {
        statusCode = 409;
        message = "Cannot perform operation: related records exist";
        code = "FOREIGN_KEY_CONSTRAINT";
    } else if (err.code === "P2000") {
        statusCode = 400;
        message = "Input value too long";
        code = "VALUE_TOO_LONG";
    }

    // ✅ Handle Joi validation errors (បើមិន catch ក្នុង middleware)
    if (err.isJoi) {
        statusCode = 400;
        message = "Validation failed";
        code = "VALIDATION_ERROR";
    }

    // ✅ Handle JSON parse errors
    if (err.type === "entity.parse.failed") {
        statusCode = 400;
        message = "Invalid JSON in request body";
        code = "INVALID_JSON";
    }

    // ✅ Handle JWT errors (បើមិន catch ក្នុង middleware)
    if (err.name === "TokenExpiredError") {
        statusCode = 401;
        message = "Token expired";
        code = "TOKEN_EXPIRED";
    } else if (err.name === "JsonWebTokenError") {
        statusCode = 401;
        message = "Invalid token";
        code = "INVALID_TOKEN";
    }

    // ✅ Log structured
    const logPayload = {
        statusCode,
        code,
        path: req.path,
        method: req.method,
        ip: req.ip || req.connection?.remoteAddress,
        user: req.user?.id || "anonymous",
    };

    if (statusCode >= 500) {
        logPayload.stack = err.stack;
        logger.error(`[${req.method}] ${req.path} - ${message}`, logPayload);
    } else {
        logger.warn(`[${req.method}] ${req.path} - ${message}`, logPayload);
    }

    // ✅ Response
    return res.status(statusCode).json({
        success: false,
        message,
        code,
        ...(process.env.NODE_ENV === "development" && {
            stack: err.stack,
        }),
        timestamp: new Date().toISOString(),
    });
};

// ===============================
// App Error
// ===============================
class AppError extends Error {
    constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
        super(message);

        this.name = "AppError";
        this.statusCode = statusCode;
        this.status = statusCode;           // ✅ backward compat
        this.code = code;
        this.isOperational = true;           // ✅ distinguish from bugs

        Error.captureStackTrace(this, this.constructor);
    }
}

// ===============================
// Other Error Classes
// ===============================

class ValidationError extends AppError {
    constructor(message = "Validation failed", code = "VALIDATION_ERROR") {
        super(message, 400, code);
    }
}

class NotFoundError extends AppError {
    constructor(message = "Resource not found", code = "NOT_FOUND") {
        super(message, 404, code);
    }
}

class UnauthorizedError extends AppError {
    constructor(message = "Unauthorized", code = "UNAUTHORIZED") {
        super(message, 401, code);
    }
}

class ForbiddenError extends AppError {
    constructor(message = "Forbidden", code = "FORBIDDEN") {
        super(message, 403, code);
    }
}

class ConflictError extends AppError {
    constructor(message = "Resource conflict", code = "CONFLICT") {
        super(message, 409, code);
    }
}

// ✅ បន្ថែមសម្រាប់ soft delete
class DeletedAccountError extends AppError {
    constructor(message = "Account has been deleted") {
        super(message, 403, "ACCOUNT_DELETED");
    }
}

class BlockedAccountError extends AppError {
    constructor(message = "Account has been blocked") {
        super(message, 403, "ACCOUNT_BLOCKED");
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
    ConflictError,
    DeletedAccountError,
    BlockedAccountError,
};