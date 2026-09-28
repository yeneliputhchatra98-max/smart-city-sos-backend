const Joi = require("joi");

// ==========================================
// Create Station Validation
// ==========================================

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

  // Province
  provinceId: Joi.string()
    .uuid()
    .required()
    .messages({
      "string.guid": "Province ID must be a valid UUID",
      "any.required": "Province is required",
    }),

  // District
  districtId: Joi.string()
    .uuid()
    .required()
    .messages({
      "string.guid": "District ID must be a valid UUID",
      "any.required": "District is required",
    }),

  // Commune / Sangkat
  communeId: Joi.string()
    .uuid()
    .required()
    .messages({
      "string.guid": "Commune ID must be a valid UUID",
      "any.required": "Commune/Sangkat is required",
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

  // ✅ កែ — ទទួលទាំង string និង number
  lat: Joi.alternatives()
    .try(
      Joi.number().min(-90).max(90),
      Joi.string().allow('', null)
    )
    .optional(),

  // ✅ កែ — ទទួលទាំង string និង number
  lng: Joi.alternatives()
    .try(
      Joi.number().min(-180).max(180),
      Joi.string().allow('', null)
    )
    .optional(),

  capacity: Joi.number()
    .integer()
    .min(0)
    .default(0),

  // ✅ កែ — ទទួល empty string
  organizationId: Joi.string()
    .uuid()
    .allow(null, '')
    .optional(),

  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED")
    .default("ACTIVE"),

}).options({ stripUnknown: true });

// ==========================================
// Update Station Validation
// ==========================================

const updateStationSchema = Joi.object({
  name: Joi.string().trim(),

  type: Joi.string()
    .valid("POLICE", "FIRE", "MEDICAL"),

  provinceId: Joi.string()
    .uuid(),

  districtId: Joi.string()
    .uuid(),

  communeId: Joi.string()
    .uuid(),

  address: Joi.string().trim(),

  hotline: Joi.string().trim(),

  // ✅ កែ — ទទួលទាំង string និង number
  lat: Joi.alternatives()
    .try(
      Joi.number().min(-90).max(90),
      Joi.string().allow('', null)
    )
    .optional(),

  // ✅ កែ — ទទួលទាំង string និង number
  lng: Joi.alternatives()
    .try(
      Joi.number().min(-180).max(180),
      Joi.string().allow('', null)
    )
    .optional(),

  capacity: Joi.number()
    .integer()
    .min(0),

  // ✅ កែ — ទទួល empty string
  organizationId: Joi.string()
    .uuid()
    .allow(null, '')
    .optional(),

  status: Joi.string()
    .valid("ACTIVE", "INACTIVE", "SUSPENDED"),

})
  .min(1)                              // ✅ បន្ថែម
  .options({ stripUnknown: true });    // ✅ បន្ថែម

// ==========================================
// Update Station Status Validation
// ==========================================

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