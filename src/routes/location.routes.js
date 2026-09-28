const express = require("express");

const router = express.Router();

const locationController = require("../controllers/location.controller");

const { validateRequest } = require("../middleware/validator");

const {
  gpsLocationSchema,
  provinceIdSchema,
  districtIdSchema,
} = require("../validators/location.validator");

// ==========================================
// GPS → Province, District & Commune
// ==========================================

router.get(
  "/reverse",
  validateRequest(gpsLocationSchema),
  locationController.getLocationFromGPS
);

// ==========================================
// Get all provinces
// ==========================================

router.get(
  "/provinces",
  locationController.getProvinces
);

// ==========================================
// Get districts by province
// ==========================================

router.get(
  "/districts",
  validateRequest(provinceIdSchema),
  locationController.getDistrictsByProvince
);

// ==========================================
// Get communes by district
// ==========================================

router.get(
  "/communes",
  validateRequest(districtIdSchema),
  locationController.getCommunesByDistrict
);

module.exports = router;