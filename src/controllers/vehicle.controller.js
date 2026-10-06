const vehicleService = require("../services/vehicle.service");

// Get all vehicles (with query filters)
exports.getAllVehicles = async (req, res, next) => {
    try {
        const result = await vehicleService.getAllVehicles(req.query);
        res.json({
            success: true,
            data: result.vehicles,
            pagination: result.pagination,
        });
    } catch (err) {
        next(err);
    }
};

// Get single vehicle by ID
exports.getVehicleById = async (req, res, next) => {
    try {
        const vehicle = await vehicleService.getVehicleById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({
                success: false,
                message: "Vehicle not found",
            });
        }
        res.json({
            success: true,
            data: vehicle,
        });
    } catch (err) {
        next(err);
    }
};

// Get fleet dashboard statistics
exports.getVehicleStats = async (req, res, next) => {
    try {
        const stats = await vehicleService.getVehicleStats();
        res.json({
            success: true,
            data: stats,
        });
    } catch (err) {
        next(err);
    }
};

// Create vehicle
exports.createVehicle = async (req, res, next) => {
    try {
        const vehicle = await vehicleService.createVehicle(req.body);
        res.status(201).json({
            success: true,
            message: "Vehicle created successfully",
            data: vehicle,
        });
    } catch (err) {
        next(err);
    }
};

// Update vehicle
exports.updateVehicle = async (req, res, next) => {
    try {
        const vehicle = await vehicleService.updateVehicle(req.params.id, req.body);
        res.json({
            success: true,
            message: "Vehicle updated successfully",
            data: vehicle,
        });
    } catch (err) {
        next(err);
    }
};

// Update vehicle status
exports.updateVehicleStatus = async (req, res, next) => {
    try {
        const vehicle = await vehicleService.updateVehicleStatus(req.params.id, req.body.status);
        res.json({
            success: true,
            message: "Vehicle status updated successfully",
            data: vehicle,
        });
    } catch (err) {
        next(err);
    }
};

// Assign vehicle
exports.assignVehicle = async (req, res, next) => {
    try {
        const vehicle = await vehicleService.assignVehicle(req.params.id, req.body);
        res.json({
            success: true,
            message: "Vehicle assigned successfully",
            data: vehicle,
        });
    } catch (err) {
        next(err);
    }
};

// Delete vehicle
exports.deleteVehicle = async (req, res, next) => {
    try {
        await vehicleService.deleteVehicle(req.params.id);
        res.json({
            success: true,
            message: "Vehicle deleted successfully",
        });
    } catch (err) {
        next(err);
    }
};
