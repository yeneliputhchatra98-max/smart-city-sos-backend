const Joi = require("joi");

const createSosSchema = Joi.object({
    // ✅ បន្ថែម citizenName
    citizenName: Joi.string()
        .min(1)
        .max(100)
        .required()
        .messages({
            'any.required': 'Name is required',
            'string.empty': 'Name cannot be empty'
        }),

    // ✅ បន្ថែម phone
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
        .valid("FIRE", "MEDICAL", "POLICE")
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

// validators/sos.validator.js

const updateStatusSchema = Joi.object({
    status: Joi.string()
        .valid("PENDING", "EN_ROUTE", "RESOLVED", "SPAM")
        //                                                              ↑
        //                                                  បន្ថែម "SPAM"
        .required(),

    assignedAgentId: Joi.string()
        .allow(null, ""),

    assignedAgentName: Joi.string()
        .allow(null, "")
});

module.exports = {
    createSosSchema,
    updateStatusSchema
};