const Joi = require("joi");

// ==========================================
// GPS Location Validation
// ==========================================

const gpsLocationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),

  lng: Joi.number().min(-180).max(180).required(),
});

// ==========================================
// Province ID Validation
// ==========================================

const provinceIdSchema = Joi.object({
  provinceId: Joi.string().uuid().required(),
});

// ==========================================
// District ID Validation
// ==========================================

const districtIdSchema = Joi.object({
  districtId: Joi.string().uuid().required(),
});

module.exports = {
  gpsLocationSchema,
  provinceIdSchema,
  districtIdSchema,
};