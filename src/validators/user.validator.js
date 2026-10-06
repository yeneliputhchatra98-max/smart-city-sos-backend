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

// ========================
// CREATE USER (ADMIN)
// ========================
const createUserSchema = Joi.object({
    fullName: Joi.string()
        .min(3)
        .max(100)
        .required()
        .messages({
            "any.required": "Full name is required",
            "string.min": "Full name must be at least 3 characters",
        }),

    username: Joi.string()
        .min(3)
        .max(50)
        .pattern(USERNAME_PATTERN)
        .required()
        .messages({
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

    roleId: Joi.number()
        .integer()
        .positive()
        .optional()
        .allow(null)
        .messages({
            "number.base": "roleId must be a number",
            "number.integer": "roleId must be an integer",
        }),

    organizationId: Joi.string()
        .uuid()
        .optional()
        .allow(null, "")
        .messages({
            "string.guid": "organizationId must be a valid UUID",
        }),

    badgeId: Joi.string()
        .max(50)
        .optional()
        .allow(null, ""),

    // ✅ បន្ថែម avatar
    avatar: Joi.string()
        .max(255)
        .optional()
        .allow(null, ""),

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
});

// ========================
// UPDATE USER
// ========================
const updateUserSchema = Joi.object({
    fullName: Joi.string().min(3).max(100),

    username: Joi.string()
        .min(3)
        .max(50)
        .pattern(USERNAME_PATTERN)
        .messages({
            "string.pattern.base": "Username cannot contain spaces",
        }),

    email: Joi.string().email().max(150).lowercase().trim(),

    phone: Joi.string().pattern(PHONE_PATTERN).messages({
        "string.pattern.base": "Invalid phone number format",
    }),

    password: passwordField.optional(),

    roleId: Joi.number()
        .integer()
        .positive()
        .optional()
        .allow(null),

    organizationId: Joi.string()
        .uuid()
        .optional()
        .allow(null, "")
        .messages({
            "string.guid": "organizationId must be a valid UUID",
        }),

    badgeId: Joi.string().max(50).optional().allow(null, ""),

    avatar: Joi.string().max(255).optional().allow(null, ""),

    birthday: Joi.date()
        .iso()
        .less("now")
        .optional()
        .allow(null, "")
        .messages({
            "date.less": "Birthday cannot be in the future",
        }),

    gender: Joi.string()
        .valid("MALE", "FEMALE", "OTHER")
        .optional()
        .allow(null, ""),
})
    .min(1)
    .messages({
        "object.min": "At least one field to update is required",
    });

// ========================
// BLOCK / UNBLOCK USER
// ========================
const blockUserSchema = Joi.object({
    status: Joi.string()
        .valid("ACTIVE", "BLOCKED", "INACTIVE")
        .required()
        .messages({
            "any.required": "Status is required",
            "any.only": "Status must be one of: ACTIVE, BLOCKED, INACTIVE",
        }),
});

// ========================
// EXPORT
// ========================
module.exports = {
    createUserSchema,
    updateUserSchema,
    blockUserSchema,
};