const Joi = require("joi");

// Create Broadcast
const createBroadcastSchema = Joi.object({

    title: Joi.string()
        .min(5)
        .max(200)
        .required(),

    message: Joi.string()
        .min(10)
        .required(),

    level: Joi.string()
        .valid(
            "INFO",
            "WARNING",
            "EMERGENCY"
        )
        .default("WARNING"),

    type: Joi.string()
        .valid(
            "SECURITY",
            "WEATHER",
            "TRAFFIC",
            "HEALTH",
            "OTHER"
        )
        .default("SECURITY"),

    targetAudience: Joi.string()
        .valid(
            "ALL_CITIZENS",
            "POLICE",
            "FIRE",
            "MEDICAL"
        )
        .default("ALL_CITIZENS"),

    targetProvinces: Joi.array()
        .items(Joi.string())
        .optional(),

    expiresAt: Joi.date()
        .optional()

});


// Update Broadcast
const updateBroadcastSchema = Joi.object({

    title: Joi.string()
        .min(5)
        .max(200)
        .optional(),

    message: Joi.string()
        .min(10)
        .optional(),

    level: Joi.string()
        .valid(
            "INFO",
            "WARNING",
            "EMERGENCY"
        )
        .optional(),

    type: Joi.string()
        .valid(
            "SECURITY",
            "WEATHER",
            "TRAFFIC",
            "HEALTH",
            "OTHER"
        )
        .optional(),

    targetAudience: Joi.string()
        .valid(
            "ALL_CITIZENS",
            "POLICE",
            "FIRE",
            "MEDICAL"
        )
        .optional(),

    targetProvinces: Joi.array()
        .items(Joi.string())
        .optional(),

    expiresAt: Joi.date()
        .optional()

}).min(1);

module.exports = {
    createBroadcastSchema,
    updateBroadcastSchema
};