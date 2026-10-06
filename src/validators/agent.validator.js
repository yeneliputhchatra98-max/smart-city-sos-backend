const Joi = require("joi");

// ============================================================
// Helpers
// ============================================================

// ✅ Validator សម្រាប់ UUID (Prisma default)
const uuidSchema = Joi.string().uuid({ version: 'uuidv4' });

// ============================================================
// Create Agent
// ============================================================
const createAgentSchema = Joi.object({
    // ✅ Field ចាំបាច់
    name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.empty': 'Name is required',
            'string.min': 'Name must be at least 2 characters',
        }),

    phone: Joi.string()
        .min(8)
        .max(20)
        .required()
        .messages({
            'string.empty': 'Phone is required',
        }),

    type: Joi.string()
        .valid("POLICE", "FIRE", "MEDICAL")
        .required()
        .messages({
            'any.only': 'Type must be POLICE, FIRE, or MEDICAL',
        }),

    // ✅ Field ស្រេចចិត្ត (Optional)
    role: Joi.string()
        .max(100)
        .optional()
        .allow('')
        .default('Responder'),

    // ✅ Hierarchy — stationId ត្រូវការ UUID
    stationId: uuidSchema
        .optional()
        .allow(null)
        .messages({
            'string.guid': 'stationId must be a valid UUID',
        }),

    organizationId: uuidSchema
        .optional()
        .allow(null)
        .messages({
            'string.guid': 'organizationId must be a valid UUID',
        }),

    // ✅ GPS Coordinates
    lat: Joi.number()
        .min(-90)
        .max(90)
        .optional()
        .allow(null)
        .messages({
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90',
        }),

    lng: Joi.number()
        .min(-180)
        .max(180)
        .optional()
        .allow(null)
        .messages({
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180',
        }),

    // ✅ Vehicle Info (Optional)
    vehicleNo: Joi.string()
        .max(50)
        .optional()
        .allow(''),

    vehicleType: Joi.string()
        .valid("CAR", "AMBULANCE", "FIRE_TRUCK", "MOTORBIKE")
        .optional()
        .allow(''),

    // ✅ Status — ត្រូវនឹង AgentStatus enum
    status: Joi.string()
        .valid("AVAILABLE", "ON_DUTY", "OFFLINE")
        .default("AVAILABLE")
        .messages({
            'any.only': 'Status must be AVAILABLE, ON_DUTY, or OFFLINE',
        }),
});

// ============================================================
// Update Agent
// ============================================================
const updateAgentSchema = Joi.object({
    name: Joi.string()
        .min(2)
        .max(100)
        .optional(),

    phone: Joi.string()
        .min(8)
        .max(20)
        .optional(),

    type: Joi.string()
        .valid("POLICE", "FIRE", "MEDICAL")
        .optional(),

    role: Joi.string()
        .max(100)
        .optional()
        .allow(''),

    stationId: uuidSchema
        .optional()
        .allow(null),

    organizationId: uuidSchema
        .optional()
        .allow(null),

    lat: Joi.number()
        .min(-90)
        .max(90)
        .optional()
        .allow(null),

    lng: Joi.number()
        .min(-180)
        .max(180)
        .optional()
        .allow(null),

    vehicleNo: Joi.string()
        .max(50)
        .optional()
        .allow(''),

    vehicleType: Joi.string()
        .valid("CAR", "AMBULANCE", "FIRE_TRUCK", "MOTORBIKE")
        .optional()
        .allow(''),

    status: Joi.string()
        .valid("AVAILABLE", "ON_DUTY", "OFFLINE")
        .optional(),
})
    .min(1)
    .messages({
        'object.min': 'At least one field is required for update',
    });

module.exports = {
    createAgentSchema,
    updateAgentSchema,
};