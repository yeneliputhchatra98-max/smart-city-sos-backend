const reportService = require("../services/report.service");

// ==========================
// Get all reports
// ==========================
exports.getReports = async (req, res, next) => {
    try {

        const reports = await reportService.getReports();

        return res.status(200).json({
            success: true,
            data: reports
        });

    } catch (err) {
        next(err);
    }
};

// ==========================
// Get report by id
// ==========================
exports.getReportById = async (req, res, next) => {
    try {

        const report = await reportService.getReportById(req.params.id);

        return res.status(200).json({
            success: true,
            data: report
        });

    } catch (err) {
        next(err);
    }
};

// ==========================
// Dashboard Summary
// ==========================
exports.getSummary = async (req, res, next) => {
    try {

        const summary = await reportService.getSummary();

        return res.status(200).json({
            success: true,
            data: summary
        });

    } catch (err) {
        next(err);
    }
};

// ==========================
// Generate Report
// ==========================
exports.generateReport = async (req, res, next) => {
    try {

        const report = await reportService.generateReport(
            req.body,
            req.user.id
        );

        return res.status(201).json({
            success: true,
            message: "Report generated successfully",
            data: report
        });

    } catch (err) {
        next(err);
    }
};

// ==========================
// Export PDF
// ==========================
exports.exportPdf = async (req, res, next) => {
    try {

        const file = await reportService.exportPdf(req.params.id);

        return res.status(200).json({
            success: true,
            data: file
        });

    } catch (err) {
        next(err);
    }
};

// ==========================
// Export Excel
// ==========================
exports.exportExcel = async (req, res, next) => {
    try {

        const file = await reportService.exportExcel(req.params.id);

        return res.status(200).json({
            success: true,
            data: file
        });

    } catch (err) {
        next(err);
    }
};

// ==========================
// Delete Report
// ==========================
exports.deleteReport = async (req, res, next) => {
    try {

        await reportService.deleteReport(req.params.id);

        return res.status(200).json({
            success: true,
            message: "Report deleted successfully"
        });

    } catch (err) {
        next(err);
    }
};