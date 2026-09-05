const Joi = require("joi");

const createStationSchema = Joi.object({
  name: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Station name is required",
      "any.required": "Station name is required",
    }),

  type: Joi.string()
    .valid("POLICE", "FIRE", "MEDICAL")
    .required()
    .messages({
      "any.only": "Type must be POLICE, FIRE, or MEDICAL",
      "any.required": "Station type is required",
    }),

  province: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Province is required",
      "any.required": "Province is required",
    }),

  district: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "District is required",
      "any.required": "District is required",
    }),

  address: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Address is required",
      "any.required": "Address is required",
    }),

  hotline: Joi.string()
    .trim()
    .required()
    .messages({
      "string.empty": "Hotline is required",
      "any.required": "Hotline is required",
    }),

  lat: Joi.number()
    .min(-90)
    .max(90)
    .allow(null),

  lng: Joi.number()
    .min(-180)
    .max(180)
    .allow(null),

  capacity: Joi.number()
    .integer()
    .min(0)
    .default(0),

  organizationId: Joi.string()
    .uuid()
    .allow(null),

  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED")
    .default("ACTIVE"),
});

const updateStationSchema = Joi.object({
  name: Joi.string().trim(),

  type: Joi.string()
    .valid("POLICE", "FIRE", "MEDICAL"),

  province: Joi.string().trim(),

  district: Joi.string().trim(),

  address: Joi.string().trim(),

  hotline: Joi.string().trim(),

  lat: Joi.number()
    .min(-90)
    .max(90)
    .allow(null),

  lng: Joi.number()
    .min(-180)
    .max(180)
    .allow(null),

  capacity: Joi.number()
    .integer()
    .min(0),

  organizationId: Joi.string()
    .uuid()
    .allow(null),

  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED"),
});

const updateStationStatusSchema = Joi.object({
  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED")
    .required(),
});

module.exports = {
  createStationSchema,
  updateStationSchema,
  updateStationStatusSchema,
};