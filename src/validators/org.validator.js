const Joi = require("joi");

// ─── Create Organization Validator ────────────────────────────────────────────

const createOrganizationSchema = Joi.object({
    name: Joi.string()
        .min(1)              // ✅ បន្ថយពី 3 → 1
        .max(150)
        .required(),

    type: Joi.string()
        .valid("POLICE", "FIRE", "MEDICAL")
        .required(),

    hotline: Joi.string()
        .min(3)
        .max(20)
        .required(),

    head: Joi.string()
        .min(1)              // ✅ បន្ថែម min
        .max(100)
        .required(),

    address: Joi.string()
        .min(1)              // ✅ បន្ថែម min
        .max(255)
        .required(),

    accessLevel: Joi.string()
        .valid("STANDARD", "MEDIUM", "HIGH")
        .optional(),

    status: Joi.string()
        .valid("ACTIVE", "INACTIVE")
        .optional(),

    gpsLat: Joi.alternatives()
        .try(
            Joi.number().min(-90).max(90),
            Joi.string().allow('')
        )
        .optional(),

    gpsLng: Joi.alternatives()
        .try(
            Joi.number().min(-180).max(180),
            Joi.string().allow('')
        )
        .optional(),

}).options({ stripUnknown: true });

// ─── Update Organization Validator ────────────────────────────────────────────

const updateOrganizationSchema = Joi.object({
    name: Joi.string()
        .min(1)              // ✅ បន្ថយពី 3 → 1
        .max(150)
        .optional(),

    hotline: Joi.string()
        .min(3)
        .max(20)
        .optional(),

    head: Joi.string()
        .min(1)              // ✅ បន្ថែម min
        .max(100)
        .optional(),

    address: Joi.string()
        .min(1)              // ✅ បន្ថែម min
        .max(255)
        .optional(),

    status: Joi.string()
        .valid("ACTIVE", "INACTIVE")
        .optional(),

    accessLevel: Joi.string()
        .valid("STANDARD", "MEDIUM", "HIGH")
        .optional(),

    gpsLat: Joi.alternatives()
        .try(
            Joi.number().min(-90).max(90),
            Joi.string().allow('')
        )
        .optional(),

    gpsLng: Joi.alternatives()
        .try(
            Joi.number().min(-180).max(180),
            Joi.string().allow('')
        )
        .optional(),

})
    .min(1)
    .options({ stripUnknown: true });

module.exports = {
    createOrganizationSchema,
    updateOrganizationSchema
};