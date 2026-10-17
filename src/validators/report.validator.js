const Joi = require("joi");

const generateReportSchema = Joi.object({
    title: Joi.string()
        .min(3)
        .max(200)
        .required(),

    reportType: Joi.string()
        .valid("SUMMARY", "DETAIL", "EXCEPTION", "DAILY", "WEEKLY", "MONTHLY", "YEARLY")
        .default("SUMMARY"),

    format: Joi.string()
        .valid("PDF", "EXCEL")
        .default("PDF"),

    recordCount: Joi.number()
        .integer()
        .min(0)
        .default(0),

    resolvedCount: Joi.number()
        .integer()
        .min(0)
        .default(0),

    delayedCount: Joi.number()
        .integer()
        .min(0)
        .default(0),

    filters: Joi.object().optional()
});

module.exports = {
    generateReportSchema
};