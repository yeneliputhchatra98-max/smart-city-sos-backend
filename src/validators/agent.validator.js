const Joi = require("joi");

// ============================================================
// Helpers
// ============================================================

// ✅ Validator សម្រាប់ UUID (Prisma default)
const uuidSchema = Joi.string().uuid({ version: 'uuidv4' });

const VALID_VEHICLE_TYPES = [
    "FIRE_TRUCK",
    "AMBULANCE",
    "POLICE_CAR",
    "MOTORBIKE",
    "RESCUE_BOAT",
    "COMMAND_UNIT",
    "OTHER",
    "CAR",
];

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
        .allow('', null)
        .default('Responder'),

    // ✅ Hierarchy — stationId
    stationId: Joi.string()
        .optional()
        .allow(null, ''),

    organizationId: Joi.string()
        .optional()
        .allow(null, ''),

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
        .allow('', null),

    vehicleType: Joi.string()
        .valid(...VALID_VEHICLE_TYPES)
        .optional()
        .allow('', null),

    // ✅ Status — ត្រូវនឹង AgentStatus enum
    status: Joi.string()
        .valid("AVAILABLE", "ON_DUTY", "OFFLINE", "EN_ROUTE", "ON_SCENE", "RESOLVING")
        .default("AVAILABLE")
        .messages({
            'any.only': 'Status must be AVAILABLE, ON_DUTY, OFFLINE, EN_ROUTE, ON_SCENE, or RESOLVING',
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
        .allow('', null),

    stationId: Joi.string()
        .optional()
        .allow(null, ''),

    organizationId: Joi.string()
        .optional()
        .allow(null, ''),

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
        .allow('', null),

    vehicleType: Joi.string()
        .valid(...VALID_VEHICLE_TYPES)
        .optional()
        .allow('', null),

    status: Joi.string()
        .valid("AVAILABLE", "ON_DUTY", "OFFLINE", "EN_ROUTE", "ON_SCENE", "RESOLVING")
        .optional(),
})
    .min(1)
    .messages({
        'object.min': 'At least one field is required for update',
    });

module.exports = {
    createAgentSchema,
    updateAgentSchema,
    VALID_VEHICLE_TYPES,
};