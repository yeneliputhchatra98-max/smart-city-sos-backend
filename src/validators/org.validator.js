const Joi = require("joi");


// Create Organization Validator
const createOrganizationSchema = Joi.object({

    name: Joi.string()
        .min(3)
        .max(150)
        .required(),

    type: Joi.string()
        .valid(
            "POLICE",
            "FIRE",
            "MEDICAL"
        )
        .required(),

    hotline: Joi.string()
        .min(8)
        .max(20)
        .required(),

    head: Joi.string()
        .max(100)
        .required(),

    address: Joi.string()
        .max(255)
        .required(),

    accessLevel: Joi.string()
        .valid(
            "STANDARD",
            "HIGH"
        )
        .optional(),

    gpsLat: Joi.number()
        .min(-90)
        .max(90)
        .optional(),

    gpsLng: Joi.number()
        .min(-180)
        .max(180)
        .optional()

});


// Update Organization Validator
const updateOrganizationSchema = Joi.object({

    name: Joi.string()
        .min(3)
        .max(150)
        .optional(),

    hotline: Joi.string()
        .min(8)
        .max(20)
        .optional(),

    head: Joi.string()
        .max(100)
        .optional(),

    address: Joi.string()
        .max(255)
        .optional(),

    status: Joi.string()
        .valid(
            "ACTIVE",
            "INACTIVE"
        )
        .optional(),

    accessLevel: Joi.string()
        .valid(
            "STANDARD",
            "HIGH"
        )
        .optional(),

    gpsLat: Joi.number()
        .min(-90)
        .max(90)
        .optional(),

    gpsLng: Joi.number()
        .min(-180)
        .max(180)
        .optional()

})
.min(1);


module.exports = {
    createOrganizationSchema,
    updateOrganizationSchema
};