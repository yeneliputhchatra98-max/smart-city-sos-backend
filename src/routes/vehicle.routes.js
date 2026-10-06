const express = require("express");
const router = express.Router();

const vehicleController = require("../controllers/vehicle.controller");

const {
    verifyToken,
    checkRole
} = require("../middleware/auth.middleware");

const {
    validateRequest
} = require("../middleware/validator");

const {
    createVehicleSchema,
    updateVehicleSchema,
    updateStatusSchema,
    assignVehicleSchema
} = require("../validators/vehicle.validator");

// ==========================
// Get fleet dashboard statistics
// (Place BEFORE /:id to prevent route shadowing)
// ==========================
router.get(
    "/stats",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT"]),
    vehicleController.getVehicleStats
);

// ==========================
// Get all vehicles
// ==========================
router.get(
    "/",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT", "CITIZEN"]),
    vehicleController.getAllVehicles
);

// ==========================
// Get vehicle by ID
// ==========================
router.get(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT"]),
    vehicleController.getVehicleById
);

// ==========================
// Create vehicle
// ==========================
router.post(
    "/",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    validateRequest(createVehicleSchema),
    vehicleController.createVehicle
);

// ==========================
// Update vehicle
// ==========================
router.put(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    validateRequest(updateVehicleSchema),
    vehicleController.updateVehicle
);

// ==========================
// Update vehicle status
// ==========================
router.patch(
    "/:id/status",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT"]),
    validateRequest(updateStatusSchema),
    vehicleController.updateVehicleStatus
);

// ==========================
// Assign vehicle to Agent / Station
// ==========================
router.post(
    "/:id/assign",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    validateRequest(assignVehicleSchema),
    vehicleController.assignVehicle
);

// ==========================
// Delete vehicle
// ==========================
router.delete(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    vehicleController.deleteVehicle
);

module.exports = router;
