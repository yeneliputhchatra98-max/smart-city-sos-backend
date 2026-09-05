const express = require("express");

const router = express.Router();

const citizenReportController = require("../controllers/citizenReport.controller");
const {
    createCitizenReportSchema,
    updateCitizenReportStatusSchema,
} = require("../validators/citizenReport.validator");

// =====================================
// Validation Middleware
// =====================================

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, {
        abortEarly: false,
    });

    if (error) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: error.details.map((detail) => ({
                field: detail.path.join("."),
                message: detail.message,
            })),
        });
    }

    next();
};

// =====================================
// Citizen Report Routes
// =====================================

// Create Citizen Report
router.post(
    "/",
    validate(createCitizenReportSchema),
    citizenReportController.createCitizenReport
);

// Get All Citizen Reports
router.get(
    "/",
    citizenReportController.getCitizenReports
);

// Get Citizen Report By ID
router.get(
    "/:id",
    citizenReportController.getCitizenReportById
);

// Update Citizen Report Status
router.patch(
    "/:id/status",
    validate(updateCitizenReportStatusSchema),
    citizenReportController.updateCitizenReportStatus
);

// Delete Citizen Report
router.delete(
    "/:id",
    citizenReportController.deleteCitizenReport
);

module.exports = router;