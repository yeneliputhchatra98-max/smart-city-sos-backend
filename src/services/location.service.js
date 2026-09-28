const axios = require("axios");

const prisma = require("../config/prisma");

// ==========================================
// Get Province, District & Commune from GPS
// Using OpenStreetMap Nominatim
// ==========================================

const getLocationFromGPS = async (lat, lng) => {
  const response = await axios.get(
    "https://nominatim.openstreetmap.org/reverse",
    {
      params: {
        lat,
        lon: lng,
        format: "json",
      },
      headers: {
        "User-Agent": "smart-city-sos",
      },
    }
  );

  const address = response.data.address;

  return {
    commune:
      address.village ||
      address.town ||
      address.suburb ||
      "Unknown",

    district:
      address.city_district ||
      address.county ||
      "Unknown",

    province:
      address.state ||
      "Unknown",
  };
};

// ==========================================
// Get All Provinces
// ==========================================

const getProvinces = async () => {
  return await prisma.province.findMany({
    orderBy: {
      name: "asc",
    },
  });
};

// ==========================================
// Get Districts by Province
// ==========================================

const getDistrictsByProvince = async (provinceId) => {
  return await prisma.district.findMany({
    where: {
      provinceId,
    },
    orderBy: {
      name: "asc",
    },
  });
};

// ==========================================
// Get Communes by District
// ==========================================

const getCommunesByDistrict = async (districtId) => {
  return await prisma.commune.findMany({
    where: {
      districtId,
    },
    orderBy: {
      name: "asc",
    },
  });
};

module.exports = {
  getLocationFromGPS,
  getProvinces,
  getDistrictsByProvince,
  getCommunesByDistrict,
};