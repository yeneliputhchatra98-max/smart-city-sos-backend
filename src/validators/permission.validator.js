const Joi = require("joi");

const updatePermissionSchema = Joi.object({
    permissions: Joi.object().pattern(
        Joi.string(),
        Joi.object().pattern(Joi.string(), Joi.boolean())
    ).required()
});

module.exports = {
    updatePermissionSchema
};