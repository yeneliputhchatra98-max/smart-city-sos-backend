const Joi = require("joi");

const updatePermissionSchema = Joi.object({

    permissions: Joi.object({

        ADMIN: Joi.object().optional(),

        OPERATOR: Joi.object().optional(),

        AGENT: Joi.object().optional(),

        CITIZEN: Joi.object().optional()

    }).required()

});


module.exports = {
    updatePermissionSchema
};