const express = require("express");

const router = express.Router();

const citizenReportController = require("../controllers/citizenReport.controller");
const {
    createCitizenReportSchema,
    updateCitizenReportStatusSchema,
} = require("../validators/citizenReport.validator");

const { upload } = require("../middleware/upload.middleware");
const { optionalAuth } = require("../middleware/auth.middleware");
const { checkMaintenanceMode } = require("../middleware/maintenance.middleware");

// =====================================
// Validation Middleware
// =====================================

const validate = (schema) => (req, res, next) => {
    const dataToValidate = { ...req.body };

    // Coerce numeric lat/lng from multipart form-data
    if (dataToValidate.lat !== undefined && dataToValidate.lat !== "") {
        const parsed = Number(dataToValidate.lat);
        if (!isNaN(parsed)) dataToValidate.lat = parsed;
    }
    if (dataToValidate.lng !== undefined && dataToValidate.lng !== "") {
        const parsed = Number(dataToValidate.lng);
        if (!isNaN(parsed)) dataToValidate.lng = parsed;
    }

    // Coerce mediaUrls from form-data if sent as JSON string or comma-separated
    if (typeof dataToValidate.mediaUrls === "string" && dataToValidate.mediaUrls.trim() !== "") {
        try {
            const parsed = JSON.parse(dataToValidate.mediaUrls);
            dataToValidate.mediaUrls = Array.isArray(parsed) ? parsed : [dataToValidate.mediaUrls];
        } catch {
            dataToValidate.mediaUrls = dataToValidate.mediaUrls
                .split(/[\n,]/)
                .map((s) => s.trim())
                .filter(Boolean);
        }
    } else if (dataToValidate.mediaUrls === "" || dataToValidate.mediaUrls === undefined) {
        delete dataToValidate.mediaUrls;
    }

    const { error, value } = schema.validate(dataToValidate, {
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

    req.body = value;
    next();
};

// =====================================
// Citizen Report Routes
// =====================================

// Create Citizen Report (supports JSON and multipart upload)
router.post(
    "/",
    optionalAuth,
    checkMaintenanceMode,
    upload.array("media", 5),
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
// ✅ កែពី "/:id/status" → "/:id"
router.patch(
    "/:id",
    validate(updateCitizenReportStatusSchema),
    citizenReportController.updateCitizenReportStatus
);

// Delete Citizen Report
router.delete(
    "/:id",
    citizenReportController.deleteCitizenReport
);

module.exports = router;