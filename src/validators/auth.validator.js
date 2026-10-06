const Joi = require("joi");

// ==================== COMMON PATTERNS ====================

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;
const PHONE_PATTERN = /^[0-9+\-\s()]{8,20}$/;
const USERNAME_PATTERN = /^\S+$/;

const passwordField = Joi.string()
    .min(8)
    .max(128)
    .pattern(PASSWORD_PATTERN)
    .messages({
        "string.min": "Password must be at least 8 characters",
        "string.pattern.base":
            "Password must contain at least one uppercase, one lowercase, and one number",
    });

// ==================== REGISTER ====================

const registerSchema = Joi.object({
    fullName: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            "string.min": "Full name must be at least 3 characters",
            "any.required": "Full name is required",
        }),

    username: Joi.string()
        .min(3)
        .max(50)
        .pattern(USERNAME_PATTERN)
        .required()
        .messages({
            "string.min": "Username must be at least 3 characters",
            "string.pattern.base": "Username cannot contain spaces",
            "any.required": "Username is required",
        }),

    email: Joi.string()
        .email()
        .max(150)
        .lowercase()
        .trim()
        .required()
        .messages({
            "string.email": "Invalid email format",
            "any.required": "Email is required",
        }),

    password: passwordField.required(),

    phone: Joi.string()
        .pattern(PHONE_PATTERN)
        .required()
        .messages({
            "string.pattern.base": "Invalid phone number format",
            "any.required": "Phone is required",
        }),

    role: Joi.string()
        .valid("ADMIN", "OPERATOR", "AGENT", "CITIZEN")
        .optional(),

    // ✅ Birthday — allow null, ""
    birthday: Joi.date()
        .iso()
        .less("now")
        .optional()
        .allow(null, "")
        .messages({
            "date.format": "Birthday must be in ISO format (YYYY-MM-DD)",
            "date.less": "Birthday cannot be in the future",
        }),

    // ✅ Gender — allow null, ""
    gender: Joi.string()
        .valid("MALE", "FEMALE", "OTHER")
        .optional()
        .allow(null, "")
        .messages({
            "any.only": "Gender must be one of: MALE, FEMALE, OTHER",
        }),
});

// ==================== LOGIN ====================

const loginSchema = Joi.object({
    email: Joi.string()
        .email()
        .lowercase()
        .trim()
        .required()
        .messages({
            "string.email": "Invalid email format",
            "any.required": "Email is required",
        }),

    password: Joi.string()
        .required()
        .messages({
            "any.required": "Password is required",
        }),

    tabId: Joi.string().optional().allow(null, ""),
});

// ==================== REFRESH ====================

const refreshSchema = Joi.object({
    refreshToken: Joi.string()
        .required()
        .messages({
            "any.required": "Refresh token is required",
        }),

    tabId: Joi.string().optional().allow(null, ""),
});

// ==================== CHANGE PASSWORD ====================

const changePasswordSchema = Joi.object({
    oldPassword: Joi.string()
        .required()
        .messages({
            "any.required": "Old password is required",
        }),

    newPassword: passwordField.required(),
});

// ==================== FORGOT PASSWORD ====================

const forgotPasswordSchema = Joi.object({
    email: Joi.string()
        .email()
        .lowercase()
        .trim()
        .required()
        .messages({
            "string.email": "Invalid email format",
            "any.required": "Email is required",
        }),
});

// ==================== RESET PASSWORD ====================

const resetPasswordSchema = Joi.object({
    token: Joi.string()
        .required()
        .messages({
            "any.required": "Token is required",
        }),

    newPassword: passwordField.required(),
});

// ==================== VERIFY EMAIL ====================

const verifyEmailSchema = Joi.object({
    token: Joi.string()
        .required()
        .messages({
            "any.required": "Verification token is required",
        }),
});

// ==================== UPDATE PROFILE ====================

const updateProfileSchema = Joi.object({
    fullName: Joi.string().min(3).max(100),

    email: Joi.string().email().lowercase().trim(),

    phone: Joi.string().pattern(PHONE_PATTERN).messages({
        "string.pattern.base": "Invalid phone number format",
    }),

    birthday: Joi.date()
        .iso()
        .less("now")
        .optional()
        .allow(null, "")
        .messages({
            "date.format": "Birthday must be in ISO format (YYYY-MM-DD)",
            "date.less": "Birthday cannot be in the future",
        }),

    gender: Joi.string()
        .valid("MALE", "FEMALE", "OTHER")
        .optional()
        .allow(null, "")
        .messages({
            "any.only": "Gender must be one of: MALE, FEMALE, OTHER",
        }),

    avatar: Joi.string().max(255).optional().allow(null, ""),
})
    .min(1)
    .messages({
        "object.min": "At least one field to update is required",
    });

// ==================== GOOGLE LOGIN ====================

const googleLoginSchema = Joi.object({
    idToken: Joi.string()
        .required()
        .messages({
            "any.required": "Google ID token is required",
            "string.empty": "Google ID token is required",
        }),
});

// ==================== EXPORT ====================

module.exports = {
    registerSchema,
    loginSchema,
    refreshSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    updateProfileSchema,
    googleLoginSchema,
};