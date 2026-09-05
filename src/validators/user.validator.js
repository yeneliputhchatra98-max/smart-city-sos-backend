const Joi = require("joi");


// ========================
// CREATE USER (ADMIN)
// ========================
const createUserSchema = Joi.object({

    fullName: Joi.string()
        .min(3)
        .required(),

    username: Joi.string()
        .min(3)
        .required(),

    email: Joi.string()
        .email()
        .required(),

    password: Joi.string()
        .min(8)
        .required(),

    phone: Joi.string()
        .required(),

    roleId: Joi.number()
        .required(),

    organizationId: Joi.number()
        .optional()
        .allow(null),

    badgeId: Joi.string()
        .optional()
        .allow(null)

});



// ========================
// UPDATE USER
// ========================
const updateUserSchema = Joi.object({

    fullName: Joi.string()
        .min(3)
        .optional(),

    username: Joi.string()
        .min(3)
        .optional(),

    email: Joi.string()
        .email()
        .optional(),

    phone: Joi.string()
        .optional(),

    roleId: Joi.number()
        .optional(),

    organizationId: Joi.number()
        .optional()
        .allow(null),

    badgeId: Joi.string()
        .optional()
        .allow(null)

});



// ========================
// UPDATE ROLE
// ========================
const updateRoleSchema = Joi.object({

    roleId: Joi.number()
        .required()

});



// ========================
// BLOCK / UNBLOCK USER
// ========================
const blockUserSchema = Joi.object({

    isActive: Joi.boolean()
        .required()

});



module.exports = {
    createUserSchema,
    updateUserSchema,
    updateRoleSchema,
    blockUserSchema
};