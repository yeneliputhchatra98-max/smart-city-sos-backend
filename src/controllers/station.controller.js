const stationService = require("../services/station.service");

// GET /api/stations
const getAllStations = async (req, res) => {
  try {
    const stations = await stationService.getAllStations(req.query);

    res.status(200).json({
      success: true,
      message: "Stations retrieved successfully",
      data: stations,
    });
  } catch (error) {
    console.error("Get stations error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve stations",
      error: error.message,
    });
  }
};

// GET /api/stations/:id
const getStationById = async (req, res) => {
  try {
    const { id } = req.params;

    const station = await stationService.getStationById(id);

    res.status(200).json({
      success: true,
      message: "Station retrieved successfully",
      data: station,
    });
  } catch (error) {
    console.error("Get station error:", error);

    if (error.message === "Station not found") {
      return res.status(404).json({
        success: false,
        message: "Station not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to retrieve station",
      error: error.message,
    });
  }
};

// POST /api/stations
const createStation = async (req, res) => {
  try {
    const station = await stationService.createStation(req.body);

    res.status(201).json({
      success: true,
      message: "Station created successfully",
      data: station,
    });
  } catch (error) {
    console.error("Create station error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create station",
      error: error.message,
    });
  }
};

// PUT /api/stations/:id
const updateStation = async (req, res) => {
  try {
    const { id } = req.params;

    const station = await stationService.updateStation(id, req.body);

    res.status(200).json({
      success: true,
      message: "Station updated successfully",
      data: station,
    });
  } catch (error) {
    console.error("Update station error:", error);

    if (error.message === "Station not found") {
      return res.status(404).json({
        success: false,
        message: "Station not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update station",
      error: error.message,
    });
  }
};

// DELETE /api/stations/:id
const deleteStation = async (req, res) => {
  try {
    const { id } = req.params;

    await stationService.deleteStation(id);

    res.status(200).json({
      success: true,
      message: "Station deleted successfully",
    });
  } catch (error) {
    console.error("Delete station error:", error);

    if (error.message === "Station not found") {
      return res.status(404).json({
        success: false,
        message: "Station not found",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete station",
      error: error.message,
    });
  }
};

// PATCH /api/stations/:id/status
const updateStationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const station = await stationService.updateStationStatus(id, status);

    res.status(200).json({
      success: true,
      message: "Station status updated successfully",
      data: station,
    });
  } catch (error) {
    console.error("Update station status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update station status",
      error: error.message,
    });
  }
};

module.exports = {
  getAllStations,
  getStationById,
  createStation,
  updateStation,
  deleteStation,
  updateStationStatus,
};