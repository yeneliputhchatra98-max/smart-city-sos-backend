const { PrismaClient } = require("@prisma/client");
const { emitBroadcastAlert } = require("../socket");

const prisma = new PrismaClient();


// ==========================
// Get Broadcast Options / Metadata
// ==========================
exports.getBroadcastOptions = async () => {
    return {
        types: [
            { value: "FIRE", label: "Fire Emergency", labelKm: "គ្រោះអគ្គិភ័យ", icon: "Flame" },
            { value: "FLOOD", label: "Flood Disaster", labelKm: "គ្រោះទឹកជំនន់", icon: "Waves" },
            { value: "STORM", label: "Severe Storm", labelKm: "ព្យុះសង្ឃរា", icon: "CloudRain" },
            { value: "TRAFFIC", label: "Traffic Accident", labelKm: "គ្រោះថ្នាក់ចរាចរណ៍", icon: "Car" },
            { value: "SECURITY", label: "Security & Safety", labelKm: "សន្តិសុខ និងសណ្ដាប់ធ្នាប់", icon: "Shield" },
            { value: "MEDICAL_CRISIS", label: "Medical Emergency", labelKm: "សង្គ្រោះបន្ទាន់/វិបត្តិសុខភាព", icon: "HeartPulse" },
            { value: "GENERAL_ANNOUNCEMENT", label: "General Announcement", labelKm: "សេចក្តីជូនដំណឹងទូទៅ", icon: "Megaphone" }
        ],
        audiences: [
            { value: "ALL_CITIZENS", label: "All Citizens", labelKm: "ប្រជាពលរដ្ឋទាំងអស់" },
            { value: "POLICE", label: "Police Officers", labelKm: "មន្ត្រីនគរបាល" },
            { value: "FIRE", label: "Firefighters", labelKm: "កងពន្លត់អគ្គិភ័យ" },
            { value: "MEDICAL", label: "Emergency Medics", labelKm: "ក្រុមគ្រូពេទ្យសង្គ្រោះ" },
            { value: "RESCUE_AGENTS", label: "Rescue Agents", labelKm: "ភ្នាក់ងារសង្គ្រោះ" }
        ],
        levels: [
            { value: "INFO", label: "Information", labelKm: "ព័ត៌មាន", color: "blue" },
            { value: "WARNING", label: "Warning", labelKm: "ការព្រមាន", color: "amber" },
            { value: "EMERGENCY", label: "Emergency", labelKm: "អាសន្នបន្ទាន់", color: "red" }
        ]
    };
};


// ==========================
// Get All Broadcasts (Paginated + Filtered)
// ==========================
exports.getAllBroadcasts = async (filters = {}) => {
    const {
        search,
        status,
        type,
        level,
        page = "1",
        limit = "10"
    } = filters;

    // ── Parse pagination ──────────────────────────────────────────────────
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    // ── Build where clause ────────────────────────────────────────────────
    const where = {};

    if (status && status !== "ALL" && status !== "All") {
        const normStatus = String(status).toUpperCase();
        if (normStatus === "ACTIVE" || normStatus === "EXPIRED") {
            where.status = normStatus;
        }
    }

    if (type && type !== "ALL" && type !== "All") {
        where.type = String(type).toUpperCase();
    }

    if (level && level !== "ALL" && level !== "All") {
        let normLevel = String(level).toUpperCase();
        if (normLevel === "EMERGENCY") normLevel = "CRITICAL";
        where.level = normLevel;
    }

    if (search && search.trim()) {
        const s = search.trim();
        where.OR = [
            { title: { contains: s } },
            { message: { contains: s } },
            { sentByName: { contains: s } }
        ];
    }

    // ── Query with pagination and aggregate stats ─────────────────────────
    const [broadcasts, total, globalTotal, globalActive, globalExpired, globalReach] = await Promise.all([
        prisma.broadcast.findMany({
            where,
            orderBy: {
                createdAt: "desc"
            },
            skip,
            take: limitNum
        }),
        prisma.broadcast.count({ where }),
        prisma.broadcast.count(),
        prisma.broadcast.count({ where: { status: "ACTIVE" } }),
        prisma.broadcast.count({ where: { status: "EXPIRED" } }),
        prisma.broadcast.aggregate({
            _sum: { reachCount: true }
        })
    ]);

    return {
        broadcasts,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.max(1, Math.ceil(total / limitNum))
        },
        stats: {
            total: globalTotal,
            active: globalActive,
            expired: globalExpired,
            totalReach: globalReach._sum.reachCount || 0
        }
    };
};


// ==========================
// Get Broadcast By ID
// ==========================
exports.getBroadcastById = async (id) => {

    return await prisma.broadcast.findUnique({
        where: {
            id: String(id)
        }
    });

};


// ==========================
// Create Broadcast
// ==========================
exports.createBroadcast = async (data, user) => {

    const {
        title,
        message,
        level,
        type,
        targetAudience,
        targetProvinces,
        expiresAt
    } = data;

    // Normalize level to Prisma BroadcastLevel: CRITICAL | WARNING | INFO
    let normLevel = (level || "WARNING").toUpperCase();
    if (normLevel === "EMERGENCY") normLevel = "CRITICAL";
    if (!["CRITICAL", "WARNING", "INFO"].includes(normLevel)) {
        normLevel = "WARNING";
    }

    // Normalize type to Prisma BroadcastType: FLOOD | STORM | FIRE | TRAFFIC | SECURITY | MEDICAL_CRISIS | GENERAL_ANNOUNCEMENT
    let normType = (type || "SECURITY").toUpperCase();
    if (normType === "WEATHER") normType = "STORM";
    else if (normType === "HEALTH") normType = "MEDICAL_CRISIS";
    else if (normType === "OTHER") normType = "GENERAL_ANNOUNCEMENT";
    if (!["FLOOD", "STORM", "FIRE", "TRAFFIC", "SECURITY", "MEDICAL_CRISIS", "GENERAL_ANNOUNCEMENT"].includes(normType)) {
        normType = "SECURITY";
    }

    // Normalize audience to Prisma AudienceType: ALL_CITIZENS | RESCUE_AGENTS
    let normAudience = (targetAudience || "ALL_CITIZENS").toUpperCase();
    if (normAudience !== "ALL_CITIZENS") {
        normAudience = "RESCUE_AGENTS";
    }

    const broadcast = await prisma.broadcast.create({

        data: {

            title,

            message,

            level: normLevel,

            type: normType,

            targetAudience: normAudience,

            targetProvinces:
                Array.isArray(targetProvinces)
                    ? targetProvinces
                    : (targetProvinces ? [targetProvinces] : ["All Cambodia"]),

            sentByName: user?.fullName || user?.name || "Admin",

            sentByUserId: user?.id ? String(user.id) : null,

            status: "ACTIVE",

            expiresAt: expiresAt
                ? new Date(expiresAt)
                : null

        }

    });

    emitBroadcastAlert(broadcast);

    return broadcast;

};


// ==========================
// Update Broadcast
// ==========================
exports.updateBroadcast = async (id, data) => {

    const updateData = { ...data };
    if (updateData.level) {
        let normLevel = updateData.level.toUpperCase();
        if (normLevel === "EMERGENCY") normLevel = "CRITICAL";
        updateData.level = normLevel;
    }
    if (updateData.type) {
        let normType = updateData.type.toUpperCase();
        if (normType === "WEATHER") normType = "STORM";
        else if (normType === "HEALTH") normType = "MEDICAL_CRISIS";
        else if (normType === "OTHER") normType = "GENERAL_ANNOUNCEMENT";
        updateData.type = normType;
    }
    if (updateData.targetAudience) {
        let normAud = updateData.targetAudience.toUpperCase();
        if (normAud !== "ALL_CITIZENS") normAud = "RESCUE_AGENTS";
        updateData.targetAudience = normAud;
    }

    return await prisma.broadcast.update({

        where: {
            id: String(id)
        },

        data: updateData

    });

};


// ==========================
// Update Status
// ==========================
exports.updateBroadcastStatus = async (id, status) => {

    const updated = await prisma.broadcast.update({

        where: {
            id: String(id)
        },

        data: {
            status: String(status).toUpperCase()
        }

    });

    emitBroadcastAlert(updated);

    return updated;

};


// ==========================
// Delete Broadcast
// ==========================
exports.deleteBroadcast = async (id) => {

    const deleted = await prisma.broadcast.delete({

        where: {
            id: String(id)
        }

    });

    try {
        const { getIO } = require("../socket");
        getIO().emit("broadcast_deleted", { id: String(id) });
    } catch (e) {
        // Socket emission failure shouldn't fail HTTP request
    }

    return deleted;

};