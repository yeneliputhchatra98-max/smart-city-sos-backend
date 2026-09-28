const locationService = require("../services/location.service");

const getLocationFromGPS = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;

    const location = await locationService.getLocationFromGPS(
      Number(lat),
      Number(lng)
    );

    res.json({
      success: true,
      data: location,
    });
  } catch (error) {
    next(error);
  }
};

const getProvinces = async (req, res, next) => {
  try {
    const provinces = await locationService.getProvinces();

    res.json({
      success: true,
      data: provinces,
    });
  } catch (error) {
    next(error);
  }
};

const getDistrictsByProvince = async (req, res, next) => {
  try {
    const { provinceId } = req.query;

    const districts =
      await locationService.getDistrictsByProvince(provinceId);

    res.json({
      success: true,
      data: districts,
    });
  } catch (error) {
    next(error);
  }
};

// ⭐ NEW: Get communes by district
const getCommunesByDistrict = async (req, res, next) => {
  try {
    const { districtId } = req.query;

    const communes =
      await locationService.getCommunesByDistrict(districtId);

    res.json({
      success: true,
      data: communes,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLocationFromGPS,
  getProvinces,
  getDistrictsByProvince,
  getCommunesByDistrict,
};