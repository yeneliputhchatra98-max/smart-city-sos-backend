const express = require("express");
const router = express.Router();

const reportController = require("../controllers/report.controller");

const {
    verifyToken,
    checkRole
} = require("../middleware/auth.middleware");

const { validateRequest } = require("../middleware/validator");

const {
    generateReportSchema
} = require("../validators/report.validator");
// ==========================
// Get all reports
// ==========================
router.get(
    "/",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    reportController.getReports
);

// ==========================
// Dashboard summary
// ==========================
router.get(
    "/summary",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    reportController.getSummary
);

// ==========================
// Get report by id
// ==========================
router.get(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    reportController.getReportById
);

// ==========================
// Generate report
// ==========================
router.post(
    "/generate",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    validateRequest(generateReportSchema),
    reportController.generateReport
);

// ==========================
// Export PDF
// ==========================
router.get(
    "/:id/pdf",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    reportController.exportPdf
);

// ==========================
// Export Excel
// ==========================
router.get(
    "/:id/excel",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    reportController.exportExcel
);

// ==========================
// Delete report
// ==========================
router.delete(
    "/:id",
    verifyToken,
    checkRole(["ADMIN"]),
    reportController.deleteReport
);

module.exports = router;