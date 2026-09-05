const axios = require("axios");


const getLocationFromGPS = async (lat, lng) => {

    const response = await axios.get(
        "https://nominatim.openstreetmap.org/reverse",
        {
            params: {
                lat,
                lon: lng,
                format: "json"
            },
            headers: {
                "User-Agent": "smart-city-sos"
            }
        }
    );


    const address = response.data.address;


    return {
        district:
            address.suburb ||
            address.city_district ||
            address.county ||
            "Unknown",

        province:
            address.state ||
            "Unknown"
    };
};


module.exports = {
    getLocationFromGPS
};