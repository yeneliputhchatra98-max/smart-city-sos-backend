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
            "EMERGENCY",
            "CRITICAL"
        )
        .default("WARNING"),

    type: Joi.string()
        .valid(
            "SECURITY",
            "WEATHER",
            "TRAFFIC",
            "HEALTH",
            "OTHER",
            "FLOOD",
            "STORM",
            "FIRE",
            "MEDICAL_CRISIS",
            "GENERAL_ANNOUNCEMENT"
        )
        .default("SECURITY"),

    targetAudience: Joi.string()
        .valid(
            "ALL_CITIZENS",
            "POLICE",
            "FIRE",
            "MEDICAL",
            "RESCUE_AGENTS"
        )
        .optional(),

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
            "EMERGENCY",
            "CRITICAL"
        )
        .optional(),

    type: Joi.string()
        .valid(
            "SECURITY",
            "WEATHER",
            "TRAFFIC",
            "HEALTH",
            "OTHER",
            "FLOOD",
            "STORM",
            "FIRE",
            "MEDICAL_CRISIS",
            "GENERAL_ANNOUNCEMENT"
        )
        .optional(),

    targetAudience: Joi.string()
        .valid(
            "ALL_CITIZENS",
            "POLICE",
            "FIRE",
            "MEDICAL",
            "RESCUE_AGENTS"
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