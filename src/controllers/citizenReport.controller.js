const citizenReportService = require("../services/citizenReport.service");

// =====================================
// Create Citizen Report
// =====================================

exports.createCitizenReport = async (req, res) => {
    try {
        const report =
            await citizenReportService.createCitizenReport(
                req.body
            );

        return res.status(201).json({
            success: true,
            message: "Citizen report created successfully",
            data: report,
        });
    } catch (error) {
        console.error(
            "Create Citizen Report Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================
// Get All Citizen Reports
// =====================================

exports.getCitizenReports = async (req, res) => {
    try {
        const result =
            await citizenReportService.getCitizenReports(
                req.query
            );

        return res.status(200).json({
            success: true,
            data: result.reports,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error(
            "Get Citizen Reports Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================
// Get Citizen Report By ID
// =====================================

exports.getCitizenReportById = async (req, res) => {
    try {
        const report =
            await citizenReportService.getCitizenReportById(
                req.params.id
            );

        return res.status(200).json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error(
            "Get Citizen Report By ID Error:",
            error
        );

        const statusCode =
            error.message === "Citizen report not found"
                ? 404
                : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================
// Update Citizen Report Status
// =====================================

exports.updateCitizenReportStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const report =
            await citizenReportService.updateCitizenReportStatus(
                req.params.id,
                status
            );

        return res.status(200).json({
            success: true,
            message: "Citizen report status updated successfully",
            data: report,
        });
    } catch (error) {
        console.error(
            "Update Citizen Report Status Error:",
            error
        );

        const statusCode =
            error.message === "Citizen report not found"
                ? 404
                : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
};

// =====================================
// Delete Citizen Report
// =====================================

exports.deleteCitizenReport = async (req, res) => {
    try {
        const result =
            await citizenReportService.deleteCitizenReport(
                req.params.id
            );

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error(
            "Delete Citizen Report Error:",
            error
        );

        const statusCode =
            error.message === "Citizen report not found"
                ? 404
                : 500;

        return res.status(statusCode).json({
            success: false,
            message: error.message,
        });
    }
};