const Joi = require("joi");

const uuidSchema = Joi.string().uuid({ version: 'uuidv4' });

const VALID_TYPES = [
    "FIRE_TRUCK",
    "AMBULANCE",
    "POLICE_CAR",
    "MOTORBIKE",
    "RESCUE_BOAT",
    "COMMAND_UNIT",
    "OTHER"
];

const VALID_STATUSES = [
    "AVAILABLE",
    "ON_DUTY",
    "DISPATCHED",
    "MAINTENANCE",
    "OUT_OF_SERVICE"
];

// ============================================================
// Create Vehicle Schema
// ============================================================
const createVehicleSchema = Joi.object({
    plateNumber: Joi.string()
        .min(2)
        .max(50)
        .required()
        .messages({
            'string.empty': 'Plate number is required',
            'any.required': 'Plate number is required',
        }),

    model: Joi.string()
        .max(100)
        .optional()
        .allow('', null),

    type: Joi.string()
        .valid(...VALID_TYPES)
        .default("POLICE_CAR")
        .messages({
            'any.only': `Type must be one of: ${VALID_TYPES.join(', ')}`,
        }),

    status: Joi.string()
        .valid(...VALID_STATUSES)
        .default("AVAILABLE")
        .messages({
            'any.only': `Status must be one of: ${VALID_STATUSES.join(', ')}`,
        }),

    fuelLevel: Joi.number()
        .min(0)
        .max(100)
        .default(100)
        .optional(),

    mileage: Joi.number()
        .min(0)
        .default(0)
        .optional(),

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

    organizationId: uuidSchema
        .optional()
        .allow(null, '')
        .messages({
            'string.guid': 'organizationId must be a valid UUID',
        }),

    stationId: uuidSchema
        .optional()
        .allow(null, '')
        .messages({
            'string.guid': 'stationId must be a valid UUID',
        }),

    assignedAgentId: uuidSchema
        .optional()
        .allow(null, '')
        .messages({
            'string.guid': 'assignedAgentId must be a valid UUID',
        }),
});

// ============================================================
// Update Vehicle Schema
// ============================================================
const updateVehicleSchema = Joi.object({
    plateNumber: Joi.string()
        .min(2)
        .max(50)
        .optional(),

    model: Joi.string()
        .max(100)
        .optional()
        .allow('', null),

    type: Joi.string()
        .valid(...VALID_TYPES)
        .optional(),

    status: Joi.string()
        .valid(...VALID_STATUSES)
        .optional(),

    fuelLevel: Joi.number()
        .min(0)
        .max(100)
        .optional(),

    mileage: Joi.number()
        .min(0)
        .optional(),

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

    organizationId: uuidSchema
        .optional()
        .allow(null, ''),

    stationId: uuidSchema
        .optional()
        .allow(null, ''),

    assignedAgentId: uuidSchema
        .optional()
        .allow(null, ''),
});

// ============================================================
// Update Status Schema
// ============================================================
const updateStatusSchema = Joi.object({
    status: Joi.string()
        .valid(...VALID_STATUSES)
        .required()
        .messages({
            'any.required': 'Status is required',
            'any.only': `Status must be one of: ${VALID_STATUSES.join(', ')}`,
        }),
});

// ============================================================
// Assign Vehicle Schema
// ============================================================
const assignVehicleSchema = Joi.object({
    agentId: uuidSchema
        .optional()
        .allow(null, ''),

    stationId: uuidSchema
        .optional()
        .allow(null, ''),

    organizationId: uuidSchema
        .optional()
        .allow(null, ''),
});

module.exports = {
    createVehicleSchema,
    updateVehicleSchema,
    updateStatusSchema,
    assignVehicleSchema,
    VALID_TYPES,
    VALID_STATUSES,
};
