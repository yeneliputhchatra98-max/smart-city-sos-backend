const { PrismaClient } = require("@prisma/client");
const { emitCitizenReportUpdated, emitStatusUpdated, emitAlertResolved } = require("../socket");

const prisma = new PrismaClient();

// =====================================
// Create Citizen Report
// =====================================

exports.createCitizenReport = async (data) => {
    const {
        citizenName,
        phone,
        type,
        title,
        description,
        province,
        district,
        lat,
        lng,
        mediaUrls,
    } = data;

    const report = await prisma.citizenReport.create({
        data: {
            citizenName,
            phone,
            type,
            title,
            description,
            province,
            district,
            lat,
            lng,
            mediaUrls,
            status: "PENDING",
        },
    });

    return report;
};

// =====================================
// Get All Citizen Reports
// =====================================

exports.getCitizenReports = async (query = {}) => {
    const {
        page = "1",
        limit = "20",
        search,
        type,
        status,
        province,
        district,
    } = query;

    const pageNum = Math.max(1, parseInt(page) || 1);

    const limitNum = Math.min(
        100,
        Math.max(1, parseInt(limit) || 20)
    );

    const skip = (pageNum - 1) * limitNum;

    const where = {};

    // Search
    if (search) {
        where.OR = [
            {
                citizenName: {
                    contains: search,
                },
            },
            {
                title: {
                    contains: search,
                },
            },
            {
                description: {
                    contains: search,
                },
            },
        ];
    }

    // Filter by Emergency Type
    if (type) {
        where.type = type;
    }

    // Filter by Status
    if (status) {
        where.status = status === "IN_PROGRESS" ? "REVIEWING" : status;
    }

    // Filter by Province
    if (province) {
        where.province = province;
    }

    // Filter by District
    if (district) {
        where.district = district;
    }

    const [reports, total] = await Promise.all([
        prisma.citizenReport.findMany({
            where,
            orderBy: {
                createdAt: "desc",
            },
            skip,
            take: limitNum,
        }),

        prisma.citizenReport.count({
            where,
        }),
    ]);

    // ── Enrich with linked SOS Alert ID & assigned unit if available ──
    const reportIds = reports.map((r) => r.id);
    let alertMap = {};
    if (reportIds.length > 0) {
        try {
            const matchedAlerts = await prisma.sOSAlert.findMany({
                where: {
                    OR: reportIds.map((id) => ({ reportText: { contains: id } })),
                },
                select: {
                    id: true,
                    status: true,
                    reportText: true,
                    assignedAgentId: true,
                    assignedAgentName: true,
                },
                orderBy: { createdAt: "desc" },
            });
            matchedAlerts.forEach((a) => {
                for (const rid of reportIds) {
                    if (a.reportText && a.reportText.includes(rid) && !alertMap[rid]) {
                        alertMap[rid] = a;
                    }
                }
            });
        } catch (_) {}
    }

    const enrichedReports = reports.map((r) => ({
        ...r,
        sosAlertId: alertMap[r.id]?.id || null,
        sosAlertStatus: alertMap[r.id]?.status || null,
        assignedAgentName: alertMap[r.id]?.assignedAgentName || null,
    }));

    return {
        reports: enrichedReports,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        },
    };
};

// =====================================
// Get Citizen Report By ID
// =====================================

exports.getCitizenReportById = async (id) => {
    const report = await prisma.citizenReport.findUnique({
        where: {
            id,
        },
    });

    if (!report) {
        throw new Error("Citizen report not found");
    }

    let linkedAlert = null;
    try {
        linkedAlert = await prisma.sOSAlert.findFirst({
            where: { reportText: { contains: id } },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true, assignedAgentId: true, assignedAgentName: true },
        });
    } catch (_) {}

    return {
        ...report,
        sosAlertId: linkedAlert?.id || null,
        sosAlertStatus: linkedAlert?.status || null,
        assignedAgentName: linkedAlert?.assignedAgentName || null,
    };
};

// =====================================
// Update Citizen Report Status
// =====================================

exports.updateCitizenReportStatus = async (id, status) => {
    const existingReport =
        await prisma.citizenReport.findUnique({
            where: {
                id,
            },
        });

    if (!existingReport) {
        throw new Error("Citizen report not found");
    }

    const normalizedStatus = status === "IN_PROGRESS" ? "REVIEWING" : status;

    const updatedReport =
        await prisma.citizenReport.update({
            where: {
                id,
            },
            data: {
                status: normalizedStatus,
            },
        });

    if (emitCitizenReportUpdated) {
        emitCitizenReportUpdated(updatedReport);
    }

    // Auto-resolve or reject any linked SOS Alerts
    if (normalizedStatus === "RESOLVED" || normalizedStatus === "REJECTED") {
        try {
            const nextAlertStatus = normalizedStatus === "REJECTED" ? "SPAM" : "RESOLVED";
            const linkedAlerts = await prisma.sOSAlert.findMany({
                where: {
                    reportText: { contains: `[Escalated from Citizen Report #${id}]` },
                    status: { in: ["PENDING", "EN_ROUTE", "ARRIVED"] },
                },
            });

            for (const alert of linkedAlerts) {
                const updatedAlert = await prisma.sOSAlert.update({
                    where: { id: alert.id },
                    data: {
                        status: nextAlertStatus,
                        resolvedAt: nextAlertStatus === "RESOLVED" ? new Date() : null,
                    },
                });
                if (emitStatusUpdated) emitStatusUpdated(updatedAlert);
                if (nextAlertStatus === "RESOLVED" && emitAlertResolved) {
                    emitAlertResolved(updatedAlert);
                }
            }
        } catch (err) {
            console.error(`Failed to cascade resolve SOS alerts for Citizen Report #${id}:`, err);
        }
    }

    return updatedReport;
};

// =====================================
// Delete Citizen Report
// =====================================

exports.deleteCitizenReport = async (id) => {
    const existingReport =
        await prisma.citizenReport.findUnique({
            where: {
                id,
            },
        });

    if (!existingReport) {
        throw new Error("Citizen report not found");
    }

    await prisma.citizenReport.delete({
        where: {
            id,
        },
    });

    // Cleanup lingering pending SOS alerts for this deleted report
    try {
        const linkedAlerts = await prisma.sOSAlert.findMany({
            where: {
                reportText: { contains: `[Escalated from Citizen Report #${id}]` },
                status: { in: ["PENDING", "EN_ROUTE", "ARRIVED"] },
            },
        });
        for (const alert of linkedAlerts) {
            const updatedAlert = await prisma.sOSAlert.update({
                where: { id: alert.id },
                data: {
                    status: "SPAM",
                    resolvedAt: new Date(),
                },
            });
            if (emitStatusUpdated) emitStatusUpdated(updatedAlert);
        }
    } catch (err) {
        console.error(`Failed to cleanup SOS alerts on delete for Citizen Report #${id}:`, err);
    }

    return {
        message: "Citizen report deleted successfully",
    };
};