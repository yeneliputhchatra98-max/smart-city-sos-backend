const prisma = require("../config/prisma");
const locationService = require("./location.service");

// ==========================
// Get all reports
// ==========================
exports.getReports = async () => {
    return await prisma.reportExport.findMany({
        include: {
            createdBy: {
                select: {
                    id: true,
                    fullName: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
    });
};

// ==========================
// Get report by id
// ==========================
exports.getReportById = async (id) => {
    const report = await prisma.reportExport.findUnique({
        where: { id },
        include: {
            createdBy: {
                select: {
                    id: true,
                    fullName: true,
                },
            },
        },
    });

    if (!report) {
        throw new Error("Report not found");
    }

    return report;
};

// ==========================
// Dashboard Summary & Analytics
// ==========================
exports.getSummary = async () => {
    // 1. Basic counts
    const [
        totalSOS,
        resolvedSOS,
        pendingSOS,
        enRouteSOS,
        totalAgents,
        onDutyAgents,
        totalOrganizations,
        totalUsers,
        allAlerts,
        districtsList,
    ] = await Promise.all([
        prisma.sOSAlert.count(),
        prisma.sOSAlert.count({ where: { status: "RESOLVED" } }),
        prisma.sOSAlert.count({ where: { status: "PENDING" } }),
        prisma.sOSAlert.count({ where: { status: "EN_ROUTE" } }),
        prisma.agent.count().catch(() => 0),
        prisma.agent.count({ where: { status: "ON_DUTY" } }).catch(() => 0),
        prisma.organization.count().catch(() => 0),
        prisma.user.count().catch(() => 0),
        prisma.sOSAlert.findMany({
            select: {
                id: true,
                type: true,
                status: true,
                district: true,
                createdAt: true,
                updatedAt: true,
                resolvedAt: true,
            },
            take: 500,
            orderBy: { createdAt: "desc" },
        }).catch(() => []),
        locationService.getDistrictsByProvince().catch(() => []),
    ]);

    // 2. Calculate Resolution Rate
    const resolutionRate = totalSOS > 0
        ? Math.round((resolvedSOS / totalSOS) * 1000) / 10
        : 0;

    // 3. Calculate Average Response Time in minutes
    let avgResponseTime = 0;
    const resolvedWithTimes = allAlerts.filter(a => a.status === "RESOLVED" && (a.resolvedAt || a.updatedAt));
    if (resolvedWithTimes.length > 0) {
        const totalMinutes = resolvedWithTimes.reduce((acc, a) => {
            const end = new Date(a.resolvedAt || a.updatedAt).getTime();
            const start = new Date(a.createdAt).getTime();
            const diffMin = Math.max(0, (end - start) / (1000 * 60));
            return acc + diffMin;
        }, 0);
        avgResponseTime = Math.round((totalMinutes / resolvedWithTimes.length) * 10) / 10;
    }

    // 4. Calculate Active / Dispatched Rate
    let activeDispatchedRate = 0;
    if (totalAgents > 0) {
        activeDispatchedRate = Math.round((onDutyAgents / totalAgents) * 1000) / 10;
    } else if (totalSOS > 0) {
        activeDispatchedRate = Math.round(((pendingSOS + enRouteSOS) / totalSOS) * 1000) / 10;
    }

    // 5. Hourly Incident Aggregation (00:00 to 23:00)
    const hours = ['00:00', '02:00', '04:00', '06:00', '08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '23:00'];
    const hourlyCounts = {};
    hours.forEach(h => { hourlyCounts[h] = 0; });

    allAlerts.forEach(alert => {
        const d = new Date(alert.createdAt);
        const hour = d.getHours();
        // Bucket into nearest even hour
        const bucketHour = hour === 23 ? '23:00' : `${String(Math.floor(hour / 2) * 2).padStart(2, '0')}:00`;
        if (hourlyCounts[bucketHour] !== undefined) {
            hourlyCounts[bucketHour]++;
        }
    });

    const hourlyIncidents = hours.map(h => ({
        hour: h,
        incidents: hourlyCounts[h] || 0,
    }));

    // 6. Emergency Type Distribution
    const typeCounts = { MEDICAL: 0, FIRE: 0, POLICE: 0, ACCIDENT: 0, CRIME: 0, FLOOD: 0, DISASTER: 0 };
    allAlerts.forEach(alert => {
        const t = (alert.type || 'POLICE').toUpperCase();
        if (typeCounts[t] !== undefined) {
            typeCounts[t]++;
        } else {
            typeCounts.POLICE++;
        }
    });

    const totalTypeAlerts = allAlerts.length;
    let emergencyTypeDistribution = [];

    if (totalTypeAlerts > 0) {
        const medicalCount = typeCounts.MEDICAL;
        const fireCount = typeCounts.FIRE;
        const policeCount = typeCounts.POLICE + typeCounts.ACCIDENT + typeCounts.CRIME + typeCounts.FLOOD + typeCounts.DISASTER;
        const sum = medicalCount + fireCount + policeCount || 1;

        emergencyTypeDistribution = [
            { name: 'Medical', value: Math.round((medicalCount / sum) * 100), count: medicalCount, color: '#EF4444' },
            { name: 'Fire', value: Math.round((fireCount / sum) * 100), count: fireCount, color: '#F59E0B' },
            { name: 'Police', value: Math.max(0, 100 - (Math.round((medicalCount / sum) * 100) + Math.round((fireCount / sum) * 100))), count: policeCount, color: '#0B3C5D' },
        ];
    } else {
        emergencyTypeDistribution = [
            { name: 'Medical', value: 0, count: 0, color: '#EF4444' },
            { name: 'Fire', value: 0, count: 0, color: '#F59E0B' },
            { name: 'Police', value: 0, count: 0, color: '#0B3C5D' },
        ];
    }


    // 7. District Response Times (Dynamic from Location Service / Database & Live Alerts)
    const districtMap = new Map();

    (districtsList || []).forEach(d => {
        const key = (d.name || '').trim().toLowerCase();
        if (key) {
            districtMap.set(key, {
                district: d.name,
                districtKm: d.nameKm || d.name,
                province: d.province?.name || '',
                alerts: [],
            });
        }
    });

    allAlerts.forEach(alert => {
        if (!alert.district) return;
        const rawDist = alert.district.trim();
        const distKey = rawDist.toLowerCase();

        let matchedKey = null;
        for (const [k, v] of districtMap.entries()) {
            const vKm = (v.districtKm || '').trim().toLowerCase();
            if (
                k === distKey ||
                (vKm && vKm === distKey) ||
                distKey.includes(k) ||
                k.includes(distKey) ||
                (vKm && distKey.includes(vKm))
            ) {
                matchedKey = k;
                break;
            }
        }

        if (matchedKey) {
            districtMap.get(matchedKey).alerts.push(alert);
        } else {
            districtMap.set(distKey, {
                district: rawDist,
                districtKm: rawDist,
                province: '',
                alerts: [alert],
            });
        }
    });

    const districtResponseTimes = Array.from(districtMap.values()).map(d => {
        const distAlerts = d.alerts;
        const resolved = distAlerts.filter(a => a.status === 'RESOLVED' && (a.resolvedAt || a.updatedAt));

        let avgTime = 0;
        if (resolved.length > 0) {
            const totalMinutes = resolved.reduce((acc, a) => {
                const end = new Date(a.resolvedAt || a.updatedAt).getTime();
                const start = new Date(a.createdAt).getTime();
                const diffMin = Math.max(0, (end - start) / (1000 * 60));
                return acc + diffMin;
            }, 0);
            avgTime = Math.round((totalMinutes / resolved.length) * 10) / 10;
        } else {
            avgTime = 0;
        }

        return {
            district: d.district,
            districtKm: d.districtKm,
            avgTime,
            count: distAlerts.length,
        };
    });

    // Sort: districts with highest incident volume first, then longest response time, then alphabetical
    districtResponseTimes.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.avgTime !== a.avgTime) return b.avgTime - a.avgTime;
        return a.district.localeCompare(b.district);
    });

    return {
        totalSOS,
        resolvedSOS,
        pendingSOS,
        enRouteSOS,
        totalAgents,
        totalOrganizations,
        totalUsers,
        kpi: {
            totalSOS,
            avgResponseTime,
            resolutionRate,
            activeDispatchedRate,
        },
        hourlyIncidents,
        emergencyTypeDistribution,
        districtResponseTimes,
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
        delayedCount,
    } = data;

    // Normalize reportType to Prisma enum: SUMMARY, DETAIL, EXCEPTION
    let normalizedType = (reportType || "SUMMARY").toUpperCase();
    if (!["SUMMARY", "DETAIL", "EXCEPTION"].includes(normalizedType)) {
        normalizedType = "SUMMARY";
    }

    // Normalize format to Prisma enum: PDF, EXCEL
    const normalizedFormat = (format || "PDF").toUpperCase() === "EXCEL" ? "EXCEL" : "PDF";

    // Validate creator user existence
    let validUserId = null;
    if (userId) {
        const userExists = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true },
        }).catch(() => null);
        if (userExists) {
            validUserId = userId;
        }
    }

    return await prisma.reportExport.create({
        data: {
            title: title || "Emergency Operational Report",
            reportType: normalizedType,
            format: normalizedFormat,
            recordCount: Number(recordCount) || 0,
            resolvedCount: Number(resolvedCount) || 0,
            delayedCount: Number(delayedCount) || 0,
            createdById: validUserId,
            fileUrl: null,
            fileSize: normalizedFormat === "EXCEL" ? "1.5 MB" : "2.8 MB",
        },
    });
};

// ==========================
// Export PDF
// ==========================
exports.exportPdf = async (id) => {
    const report = await prisma.reportExport.findUnique({
        where: { id },
    }).catch(() => null);

    if (!report) {
        const error = new Error("Report not found");
        error.statusCode = 404;
        throw error;
    }

    return report;
};

// ==========================
// Export Excel
// ==========================
exports.exportExcel = async (id) => {
    const report = await prisma.reportExport.findUnique({
        where: { id },
    }).catch(() => null);

    if (!report) {
        const error = new Error("Report not found");
        error.statusCode = 404;
        throw error;
    }

    return report;
};

// ==========================
// Delete Report
// ==========================
exports.deleteReport = async (id) => {
    const report = await prisma.reportExport.findUnique({
        where: { id },
    }).catch(() => null);

    if (!report) {
        return { id, message: "Report removed" };
    }

    return await prisma.reportExport.delete({
        where: { id },
    });
};