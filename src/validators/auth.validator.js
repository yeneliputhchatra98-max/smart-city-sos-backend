const Joi = require("joi");
const googleLoginSchema = Joi.object({
    idToken: Joi.string()
        .required()
        .messages({
            "any.required": "Google ID token is required",
            "string.empty": "Google ID token is required"
        })
});
// ==================== APPLE LOGIN ====================

const appleLoginSchema = Joi.object({

    identityToken: Joi.string()
        .required()
        .messages({
            "any.required":
                "Apple identity token is required",

            "string.empty":
                "Apple identity token is required"
        }),

    authorizationCode: Joi.string()
        .allow(null, "")
        .optional()

});
const registerSchema = Joi.object({

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
        .required()

});



const loginSchema = Joi.object({

    email: Joi.string()
        .email()
        .required(),

    password: Joi.string()
        .required()

});



const refreshSchema = Joi.object({

    refreshToken: Joi.string()
        .required()

});



const changePasswordSchema = Joi.object({

    oldPassword: Joi.string()
        .required(),

    newPassword: Joi.string()
        .min(8)
        .required()

});



const forgotPasswordSchema = Joi.object({

    email: Joi.string()
        .email()
        .required()

});



const resetPasswordSchema = Joi.object({

    token: Joi.string()
        .required(),

    newPassword: Joi.string()
        .min(8)
        .required()

});



const verifyEmailSchema = Joi.object({

    token:Joi.string()
        .required()

});



const updateProfileSchema = Joi.object({

    fullName:Joi.string()
        .optional(),

    email:Joi.string()
        .email()
        .optional(),

    phone:Joi.string()
        .optional(),

    avatar:Joi.string()
        .optional()

});


module.exports = {
    registerSchema,
    loginSchema,
    refreshSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    updateProfileSchema,
    googleLoginSchema,
    appleLoginSchema
};