const Joi = require("joi");

// =====================================
// Create Citizen Report Validator
// =====================================

exports.createCitizenReportSchema = Joi.object({
    citizenName: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
            "string.empty": "Citizen name is required",
            "string.min": "Citizen name must be at least 2 characters",
            "string.max": "Citizen name must not exceed 100 characters",
            "any.required": "Citizen name is required",
        }),

    phone: Joi.string()
        .trim()
        .pattern(/^[0-9+\-\s()]+$/)
        .max(20)
        .allow(null, "")
        .messages({
            "string.pattern.base": "Invalid phone number",
            "string.max": "Phone number must not exceed 20 characters",
        }),

    type: Joi.string()
        .valid(
            "FIRE",
            "MEDICAL",
            "POLICE",
            "ACCIDENT",
            "CRIME",
            "FLOOD",
            "DISASTER"
        )
        .required()
        .messages({
            "any.only": "Invalid emergency type",
            "any.required": "Emergency type is required",
        }),

    title: Joi.string()
        .trim()
        .min(3)
        .max(200)
        .required()
        .messages({
            "string.empty": "Title is required",
            "string.min": "Title must be at least 3 characters",
            "string.max": "Title must not exceed 200 characters",
            "any.required": "Title is required",
        }),

    description: Joi.string()
        .trim()
        .min(5)
        .max(2000)
        .required()
        .messages({
            "string.empty": "Description is required",
            "string.min": "Description must be at least 5 characters",
            "string.max": "Description must not exceed 2000 characters",
            "any.required": "Description is required",
        }),

    province: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
            "string.empty": "Province is required",
            "any.required": "Province is required",
        }),

    district: Joi.string()
        .trim()
        .min(2)
        .max(100)
        .required()
        .messages({
            "string.empty": "District is required",
            "any.required": "District is required",
        }),

    lat: Joi.number()
        .min(-90)
        .max(90)
        .allow(null)
        .messages({
            "number.base": "Latitude must be a number",
            "number.min": "Latitude must be between -90 and 90",
            "number.max": "Latitude must be between -90 and 90",
        }),

    lng: Joi.number()
        .min(-180)
        .max(180)
        .allow(null)
        .messages({
            "number.base": "Longitude must be a number",
            "number.min": "Longitude must be between -180 and 180",
            "number.max": "Longitude must be between -180 and 180",
        }),

    mediaUrls: Joi.array()
        .items(Joi.string().uri())
        .allow(null)
        .messages({
            "array.base": "Media URLs must be an array",
            "string.uri": "Invalid media URL",
        }),
}).unknown(false);

// =====================================
// Update Citizen Report Status Validator
// =====================================

exports.updateCitizenReportStatusSchema = Joi.object({
    status: Joi.string()
        .valid(
            "PENDING",
            "REVIEWING",
            "RESOLVED",
            "REJECTED"
        )
        .required()
        .messages({
            "any.only": "Invalid report status",
            "any.required": "Report status is required",
        }),
}).unknown(false);