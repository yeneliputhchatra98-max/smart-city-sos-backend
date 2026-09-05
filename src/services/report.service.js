const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ==========================
// Get all reports
// ==========================
exports.getReports = async () => {

    return await prisma.reportExport.findMany({

        include: {
            createdBy: {
                select: {
                    id: true,
                    fullName: true
                }
            }
        },

        orderBy: {
            createdAt: "desc"
        }

    });

};

// ==========================
// Get report by id
// ==========================
exports.getReportById = async (id) => {

    const report = await prisma.reportExport.findUnique({

        where: {
            id
        },

        include: {
            createdBy: {
                select: {
                    id: true,
                    fullName: true
                }
            }
        }

    });

    if (!report) {
        throw new Error("Report not found");
    }

    return report;

};

// ==========================
// Dashboard Summary
// ==========================
exports.getSummary = async () => {

    const totalSOS = await prisma.sOS.count();

    const resolvedSOS = await prisma.sOS.count({
        where: {
            status: "RESOLVED"
        }
    });

    const pendingSOS = await prisma.sOS.count({
        where: {
            status: "PENDING"
        }
    });

    const totalAgents = await prisma.agent.count();

    const totalOrganizations = await prisma.organization.count();

    const totalUsers = await prisma.user.count();

    return {

        totalSOS,

        resolvedSOS,

        pendingSOS,

        totalAgents,

        totalOrganizations,

        totalUsers

    };

};

// ==========================
// Generate Report
// ==========================
exports.generateReport = async (data, userId) => {

    const {

        title,

        reportType,

        format,

        recordCount,

        resolvedCount,

        delayedCount

    } = data;

    return await prisma.reportExport.create({

        data: {

            title: title || "Emergency Report",

            reportType: (reportType || "SUMMARY").toUpperCase(),

            format: (format || "PDF").toUpperCase(),

            recordCount: recordCount || 0,

            resolvedCount: resolvedCount || 0,

            delayedCount: delayedCount || 0,

            createdById: userId,

            fileUrl: null,

            fileSize:
                format?.toUpperCase() === "EXCEL"
                    ? "1.5 MB"
                    : "2.8 MB"

        }

    });

};

// ==========================
// Export PDF
// ==========================
exports.exportPdf = async (id) => {

    const report = await prisma.reportExport.findUnique({

        where: {
            id
        }

    });

    if (!report) {
        throw new Error("Report not found");
    }

    return report;

};

// ==========================
// Export Excel
// ==========================
exports.exportExcel = async (id) => {

    const report = await prisma.reportExport.findUnique({

        where: {
            id
        }

    });

    if (!report) {
        throw new Error("Report not found");
    }

    return report;

};

// ==========================
// Delete Report
// ==========================
exports.deleteReport = async (id) => {

    const report = await prisma.reportExport.findUnique({

        where: {
            id
        }

    });

    if (!report) {
        throw new Error("Report not found");
    }

    return await prisma.reportExport.delete({

        where: {
            id
        }

    });

};