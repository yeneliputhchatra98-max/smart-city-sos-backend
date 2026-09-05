const Joi = require("joi");

const createNewsSchema = Joi.object({
    title: Joi.string().min(5).max(200).required(),

    content: Joi.string().min(20).required(),

    image: Joi.string().uri().optional(),

    status: Joi.string()
        .valid("DRAFT", "PUBLISHED", "ARCHIVED")
        .required(),
});

module.exports = {
    createNewsSchema,
};