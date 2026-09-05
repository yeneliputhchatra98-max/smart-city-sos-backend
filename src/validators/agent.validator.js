const Joi = require("joi");

// Create Agent
const createAgentSchema = Joi.object({

    fullName: Joi.string()
        .min(3)
        .max(100)
        .required(),

    phone: Joi.string()
        .min(8)
        .max(20)
        .required(),

    organizationId: Joi.number()
        .integer()
        .required(),

    departmentId: Joi.number()
        .integer()
        .required(),

    vehicleType: Joi.string()
        .valid(
            "CAR",
            "AMBULANCE",
            "FIRE_TRUCK",
            "MOTORBIKE"
        )
        .required(),

    status: Joi.string()
        .valid(
            "AVAILABLE",
            "BUSY",
            "OFFLINE"
        )
        .default("AVAILABLE")

});


// Update Agent
const updateAgentSchema = Joi.object({

    fullName: Joi.string()
        .min(3)
        .max(100)
        .optional(),

    phone: Joi.string()
        .min(8)
        .max(20)
        .optional(),

    organizationId: Joi.number()
        .integer()
        .optional(),

    departmentId: Joi.number()
        .integer()
        .optional(),

    vehicleType: Joi.string()
        .valid(
            "CAR",
            "AMBULANCE",
            "FIRE_TRUCK",
            "MOTORBIKE"
        )
        .optional(),

    status: Joi.string()
        .valid(
            "AVAILABLE",
            "BUSY",
            "OFFLINE"
        )
        .optional()

}).min(1);


module.exports = {
    createAgentSchema,
    updateAgentSchema
};