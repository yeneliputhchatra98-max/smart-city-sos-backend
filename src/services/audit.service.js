const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
// =============================
// Get Audit Logs
// =============================
exports.getAuditLogs = async (query) => {
    const {
        search,
        category,
        level,
        startDate,
        endDate,
        page = "1",
        limit = "10"
    } = query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const andConditions = [];

    // Search query
    if (search && search.trim()) {
        const s = search.trim();
        andConditions.push({
            OR: [
                { event: { contains: s } },
                { userName: { contains: s } },
                { ipAddress: { contains: s } }
            ]
        });
    }

    // Category filter
    if (category && category !== "all") {
        if (category === "auth") {
            andConditions.push({
                OR: [
                    { event: { contains: "login" } },
                    { event: { contains: "logout" } },
                    { event: { contains: "auth" } },
                    { event: { contains: "password" } },
                    { event: { contains: "session" } },
                    { event: { contains: "token" } },
                    { event: { contains: "blocked" } }
                ]
            });
        } else if (category === "sos_dispatch") {
            andConditions.push({
                OR: [
                    { event: { contains: "sos" } },
                    { event: { contains: "dispatch" } },
                    { event: { contains: "incident" } },
                    { event: { contains: "emergency" } },
                    { event: { contains: "broadcast" } },
                    { event: { contains: "citizen" } }
                ]
            });
        } else if (category === "crud") {
            andConditions.push({
                OR: [
                    { event: { contains: "create" } },
                    { event: { contains: "update" } },
                    { event: { contains: "delete" } },
                    { event: { contains: "registered" } },
                    { event: { contains: "status" } },
                    { event: { contains: "removed" } }
                ]
            });
        } else if (category === "system") {
            andConditions.push({
                OR: [
                    { event: { contains: "system" } },
                    { event: { contains: "backup" } },
                    { event: { contains: "server" } },
                    { event: { contains: "network" } },
                    { event: { contains: "security" } },
                    { event: { contains: "setting" } }
                ]
            });
        }
    }

    // Severity level filter
    if (level && level !== "all") {
        if (level === "security") {
            andConditions.push({
                OR: [
                    { event: { contains: "security" } },
                    { event: { contains: "unauthorized" } },
                    { event: { contains: "critical" } },
                    { event: { contains: "attack" } },
                    { event: { contains: "breach" } }
                ]
            });
        } else if (level === "error") {
            andConditions.push({
                OR: [
                    { event: { contains: "failed" } },
                    { event: { contains: "error" } },
                    { event: { contains: "exception" } },
                    { event: { contains: "crashed" } }
                ]
            });
        } else if (level === "warning") {
            andConditions.push({
                OR: [
                    { event: { contains: "warn" } },
                    { event: { contains: "revoked" } },
                    { event: { contains: "deleted" } },
                    { event: { contains: "blocked" } }
                ]
            });
        } else if (level === "info") {
            andConditions.push({
                NOT: {
                    OR: [
                        { event: { contains: "security" } },
                        { event: { contains: "unauthorized" } },
                        { event: { contains: "critical" } },
                        { event: { contains: "attack" } },
                        { event: { contains: "breach" } },
                        { event: { contains: "failed" } },
                        { event: { contains: "error" } },
                        { event: { contains: "exception" } },
                        { event: { contains: "crashed" } },
                        { event: { contains: "warn" } },
                        { event: { contains: "revoked" } },
                        { event: { contains: "deleted" } },
                        { event: { contains: "blocked" } }
                    ]
                }
            });
        }
    }

    // Date range filter
    if (startDate || endDate) {
        const dateCondition = {};
        if (startDate) {
            dateCondition.gte = new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateCondition.lte = end;
        }
        andConditions.push({ createdAt: dateCondition });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [logs, filteredTotal, totalAll, todayCount, securityCount, crudCount] = await Promise.all([
        prisma.auditLog.findMany({
            where,
            orderBy: {
                createdAt: "desc"
            },
            skip,
            take: limitNum,
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        badgeId: true,
                        role: true
                    }
                }
            }
        }),
        prisma.auditLog.count({ where }),
        prisma.auditLog.count(),
        prisma.auditLog.count({
            where: {
                createdAt: {
                    gte: startOfToday
                }
            }
        }),
        prisma.auditLog.count({
            where: {
                OR: [
                    { event: { contains: "security" } },
                    { event: { contains: "unauthorized" } },
                    { event: { contains: "critical" } },
                    { event: { contains: "attack" } },
                    { event: { contains: "breach" } },
                    { event: { contains: "failed" } },
                    { event: { contains: "error" } },
                    { event: { contains: "warn" } }
                ]
            }
        }),
        prisma.auditLog.count({
            where: {
                OR: [
                    { event: { contains: "create" } },
                    { event: { contains: "update" } },
                    { event: { contains: "delete" } },
                    { event: { contains: "registered" } },
                    { event: { contains: "status" } },
                    { event: { contains: "removed" } }
                ]
            }
        })
    ]);

    const paginationData = {
        total: filteredTotal,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(filteredTotal / limitNum))
    };

    return {
        data: logs,
        meta: paginationData,
        pagination: paginationData,
        stats: {
            total: totalAll,
            todayCount,
            securityCount,
            crudCount
        }
    };
};
// =============================
// Write Audit Log (System)
// =============================
exports.writeAuditLog = async ({
    event,
    userName,
    userId,
    ipAddress
}) => {
    try {
        const log = await prisma.auditLog.create({
            data: {
                time:
                    new Date()
                    .toLocaleTimeString(
                        "en-US",
                        {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: false
                        }
                    ),
                event:
                    event || "System Event",
                userName:
                    userName || "System",
                userId:
                    userId || null,
                ipAddress:
                    ipAddress || null
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        badgeId: true,
                        role: true
                    }
                }
            }
        });

        try {
            const { emitAuditLogCreated } = require("../socket");
            emitAuditLogCreated(log);
        } catch (_) {}

        return log;
    } catch (err) {
        // Audit fail មិនគួរធ្វើឱ្យ System Crash
        console.error(
            "[AuditLog Error]",
            err.message
        );
    }
};
// =============================
// Create Audit Log (Manual)
// =============================
exports.createAuditLog = async (data, userId = null) => {
    const { event } = data;

    if (!event) {
        throw new Error("Event is required");
    }

    try {
        const log = await prisma.auditLog.create({
            data: {
                time: new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false
                }),
                event: event,
                userName: data.userName || "System",
                userId: userId || data.userId || null,
                ipAddress: data.ipAddress || null
            },
            include: {
                user: {
                    select: {
                        id: true,
                        fullName: true,
                        badgeId: true,
                        role: true
                    }
                }
            }
        });

        try {
            const { emitAuditLogCreated } = require("../socket");
            emitAuditLogCreated(log);
        } catch (_) {}

        return log;
    } catch (err) {
        console.error("[AuditLog Error]", err.message);
        throw err;
    }
};

// =============================
// Helper: Cleanup Old Physical Server Log Files (> 7 Days)
// =============================
function cleanupOldLogFiles(retentionDays = 7) {
    try {
        const logDir = path.join(__dirname, "../logs");
        if (!fs.existsSync(logDir)) return 0;

        const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        const files = fs.readdirSync(logDir);
        let cleaned = 0;

        for (const file of files) {
            const filePath = path.join(logDir, file);
            try {
                const stat = fs.statSync(filePath);
                if (stat.isFile() && stat.mtimeMs < cutoffTime) {
                    if (file.endsWith(".log")) {
                        // Truncate active core log files if untouched for > 7 days
                        fs.truncateSync(filePath, 0);
                        cleaned++;
                    } else {
                        // Delete rotated/archive files older than 7 days
                        fs.unlinkSync(filePath);
                        cleaned++;
                    }
                }
            } catch (_) {}
        }
        return cleaned;
    } catch (err) {
        console.warn("[FileLog Cleanup Warning]", err.message);
        return 0;
    }
}

// =============================
// Cleanup Old Logs (Auto/Manual for logs >= 7 days)
// =============================
exports.cleanupOldLogs = async (retentionDays = 7, triggerUser = null) => {
    try {
        const days = Math.max(1, parseInt(retentionDays) || 7);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        // Delete logs older than cutoffDate (>= 7 days old)
        const deleteResult = await prisma.auditLog.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate
                }
            }
        });

        // Also clean up physical server log files older than 7 days
        cleanupOldLogFiles(days);

        const now = new Date();
        // Update or insert system settings for cleanup tracking
        try {
            await prisma.systemSetting.upsert({
                where: { key: "audit_log_last_cleanup" },
                update: { value: now.toISOString() },
                create: {
                    key: "audit_log_last_cleanup",
                    value: now.toISOString(),
                    description: "Timestamp of last audit log auto cleanup"
                }
            });
            await prisma.systemSetting.upsert({
                where: { key: "audit_log_retention_days" },
                update: { value: String(days) },
                create: {
                    key: "audit_log_retention_days",
                    value: String(days),
                    description: "Retention period in days for audit logs"
                }
            });
        } catch (settingErr) {
            console.warn("[AuditLog Cleanup Setting Warning]", settingErr.message);
        }

        const actorName = triggerUser?.fullName || triggerUser?.userName || "System Scheduler (Auto)";
        const actorId = triggerUser?.id || null;

        // Record a cleanup audit entry if any records were purged
        if (deleteResult.count > 0) {
            const cleanupLog = await prisma.auditLog.create({
                data: {
                    time: now.toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false
                    }),
                    event: `Auto Cleanup: Purged ${deleteResult.count} audit logs older than ${days} days`,
                    userName: actorName,
                    userId: actorId,
                    ipAddress: triggerUser?.ip || "127.0.0.1"
                }
            });

            try {
                const { emitAuditLogCreated } = require("../socket");
                emitAuditLogCreated(cleanupLog);
            } catch (_) {}
        }

        return {
            deletedCount: deleteResult.count,
            retentionDays: days,
            cutoffDate: cutoffDate.toISOString(),
            lastCleanup: now.toISOString()
        };
    } catch (err) {
        console.error("[AuditLog Cleanup Error]", err.message);
        throw err;
    }
};

// =============================
// Get Cleanup Status & Statistics
// =============================
exports.getCleanupStatus = async () => {
    try {
        const retentionDays = 7;
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // Check how many logs are eligible for cleanup (>= 7 days old)
        let oldLogsEligible = await prisma.auditLog.count({
            where: {
                createdAt: {
                    lt: cutoffDate
                }
            }
        });

        let lastCleanup = null;

        // If any eligible logs exist, automatically purge them immediately so they never linger
        if (oldLogsEligible > 0) {
            try {
                console.log(`[AuditLog Auto-Cleanup] Auto-purging ${oldLogsEligible} logs older than ${retentionDays} days...`);
                const autoPurgeResult = await exports.cleanupOldLogs(retentionDays, null);
                lastCleanup = autoPurgeResult.lastCleanup;
                oldLogsEligible = 0;
            } catch (autoErr) {
                console.warn("[AuditLog Auto-Cleanup Trigger Warning]", autoErr.message);
            }
        }

        // Retrieve last cleanup timestamp from settings if not set above
        if (!lastCleanup) {
            try {
                const setting = await prisma.systemSetting.findUnique({
                    where: { key: "audit_log_last_cleanup" }
                });
                if (setting?.value) {
                    lastCleanup = setting.value;
                }
            } catch (_) {}
        }

        const nextCleanup = nextScheduledCleanupTime || 
            new Date(Date.now() + 60 * 60 * 1000).toISOString();

        return {
            autoCleanupEnabled: true,
            intervalDays: 7,
            retentionDays: 7,
            lastCleanup,
            nextCleanup,
            oldLogsEligible
        };
    } catch (err) {
        console.error("[AuditLog GetCleanupStatus Error]", err.message);
        return {
            autoCleanupEnabled: true,
            intervalDays: 7,
            retentionDays: 7,
            lastCleanup: null,
            nextCleanup: null,
            oldLogsEligible: 0
        };
    }
};

// =============================
// Start Auto Cleanup Scheduler (Runs Continuously Every Hour & Startup)
// =============================
let autoCleanupTimer = null;
let nextScheduledCleanupTime = null;

exports.startAuditLogAutoCleanup = () => {
    if (autoCleanupTimer) return;

    const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check and purge every 1 hour
    const RETENTION_DAYS = 7;

    const updateNextSchedule = () => {
        nextScheduledCleanupTime = new Date(Date.now() + CHECK_INTERVAL_MS).toISOString();
    };

    const runAutoPurge = async () => {
        try {
            updateNextSchedule();
            const result = await exports.cleanupOldLogs(RETENTION_DAYS, null);
            if (result.deletedCount > 0) {
                console.log(`[AuditLog Scheduler] Auto cleanup purged ${result.deletedCount} logs older than ${RETENTION_DAYS} days.`);
            }
        } catch (err) {
            console.error("[AuditLog Scheduler Error]", err.message);
        }
    };

    updateNextSchedule();

    // Run initial auto cleanup 5 seconds after server start
    setTimeout(runAutoPurge, 5000);

    // Recurring check every 1 hour to guarantee any logs reaching 7 days old are deleted
    autoCleanupTimer = setInterval(runAutoPurge, CHECK_INTERVAL_MS);
    if (autoCleanupTimer.unref) {
        autoCleanupTimer.unref();
    }
};