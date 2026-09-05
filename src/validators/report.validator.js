const Joi = require("joi");

const generateReportSchema = Joi.object({

    title: Joi.string()
        .min(3)
        .max(200)
        .required(),

    reportType: Joi.string()
        .valid("SUMMARY", "DAILY", "WEEKLY", "MONTHLY", "YEARLY")
        .required(),

    format: Joi.string()
        .valid("PDF", "EXCEL")
        .required(),

    recordCount: Joi.number()
        .integer()
        .min(0)
        .required(),

    resolvedCount: Joi.number()
        .integer()
        .min(0)
        .required(),

    delayedCount: Joi.number()
        .integer()
        .min(0)
        .required()

});

module.exports = {
    generateReportSchema
};