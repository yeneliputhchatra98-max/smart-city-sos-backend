const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
// =============================
// Get Audit Logs
// =============================
exports.getAuditLogs = async (query) => {
    const {
        search,
        page = "1",
        limit = "50"
    } = query;
    const pageNum = Math.max(
        1,
        parseInt(page)
    );
    const limitNum = Math.min(
        200,
        Math.max(1, parseInt(limit))
    );
    const skip = (pageNum - 1) * limitNum;
    const where = {};
    if (search) {
        where.OR = [
            {
                event: {
                    contains: search
                }
            },
            {
                userName: {
                    contains: search
                }
            },
            {
                ipAddress: {
                    contains: search
                }
            }
        ];
    }
    const [logs, total] = await Promise.all([
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
        prisma.auditLog.count({
            where
        })
    ]);
    return {
        data: logs,
        meta: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages:
                Math.ceil(total / limitNum)
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
        await prisma.auditLog.create({
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
            }
        });
    } catch (err) {
        // Audit fail មិនគួរធ្វើឱ្យ System Crash
        console.error(
            "[AuditLog Error]",
            err.message
        );
    }
};