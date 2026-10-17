const Joi = require("joi");

const createSosSchema = Joi.object({
    citizenName: Joi.string()
        .min(1)
        .max(100)
        .required()
        .messages({
            'any.required': 'Name is required',
            'string.empty': 'Name cannot be empty'
        }),

    phone: Joi.string()
        .pattern(/^[0-9+\-\s()]+$/)
        .min(8)
        .max(20)
        .required()
        .messages({
            'any.required': 'Phone number is required',
            'string.empty': 'Phone number cannot be empty'
        }),

    type: Joi.string()
        .valid("FIRE", "MEDICAL", "POLICE", "ACCIDENT", "CRIME", "FLOOD", "DISASTER")
        .required(),

    lat: Joi.number()
        .min(-90)
        .max(90)
        .required(),

    lng: Joi.number()
        .min(-180)
        .max(180)
        .required(),

    district: Joi.string()
        .max(100)
        .required()
        .messages({
            'any.required': 'District is required'
        }),

    province: Joi.string()
        .max(100)
        .required()
        .messages({
            'any.required': 'Province is required'
        }),

    reportText: Joi.string()
        .max(500)
        .allow("")
        .optional(),

    hasMedia: Joi.boolean()
        .optional()
        .default(false),

    mediaUrls: Joi.array()
        .items(Joi.string().uri())
        .optional(),

    status: Joi.string()
        .valid("PENDING", "EN_ROUTE", "RESOLVED", "SPAM")
        .optional()
        .default("PENDING"),
});

const updateStatusSchema = Joi.object({
    status: Joi.string()
        .valid("PENDING", "EN_ROUTE", "RESOLVED", "SPAM")
        .required(),

    assignedAgentId: Joi.string()
        .allow(null, ""),

    assignedAgentName: Joi.string()
        .allow(null, "")
});

const dispatchAgentSchema = Joi.object({
    agentId: Joi.string()
        .required()
        .messages({
            'any.required': 'Agent ID is required for dispatch',
            'string.empty': 'Agent ID cannot be empty',
        }),
});

module.exports = {
    createSosSchema,
    updateStatusSchema,
    dispatchAgentSchema,
};