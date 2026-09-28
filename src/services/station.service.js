const prisma = require("../config/prisma");

// ==========================================
// Get all stations
// ==========================================

const getAllStations = async (filters = {}) => {
    const {
        type,
        provinceId,
        districtId,
        communeId,
        status,
        organizationId,
        search,
        page = "1",
        limit = "10",
    } = filters;

    // ── Parse pagination ──────────────────────────────────────────────────
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    // ── Build where clause ────────────────────────────────────────────────
    const where = {
        ...(type && { type }),
        ...(provinceId && { provinceId }),
        ...(districtId && { districtId }),
        ...(communeId && { communeId }),
        ...(status && { status }),
        ...(organizationId && { organizationId }),

        ...(search && {
            OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { address: { contains: search, mode: 'insensitive' } },
                { hotline: { contains: search, mode: 'insensitive' } },
            ],
        }),
    };

    // ── Query with pagination ─────────────────────────────────────────────
    const [stations, total] = await Promise.all([
        prisma.station.findMany({
            where,
            include: {
                province: true,
                district: true,
                commune: true,
                organization: true,
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limitNum,
        }),
        prisma.station.count({ where }),
    ]);

    return {
        stations,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
        },
    };
};
// ==========================================
// Get station by ID
// ==========================================

const getStationById = async (id) => {
    const station = await prisma.station.findUnique({
        where: { id },

        include: {
            province: true,
            district: true,
            commune: true,
            organization: true,
        },
    });

    if (!station) {
        throw new Error("Station not found");
    }

    return station;
};

// ==========================================
// Create station
// ==========================================

const createStation = async (data) => {
    return await prisma.station.create({
        data: {
            name: data.name,
            type: data.type,

            provinceId: data.provinceId,
            districtId: data.districtId,
            communeId: data.communeId,

            address: data.address,
            hotline: data.hotline,
            lat: data.lat,
            lng: data.lng,
            capacity: data.capacity || 0,

            organizationId: data.organizationId || null,
            status: data.status || "ACTIVE",
        },

        include: {
            province: true,
            district: true,
            commune: true,
            organization: true,
        },
    });
};

// ==========================================
// Update station
// ==========================================

const updateStation = async (id, data) => {
    const station = await prisma.station.findUnique({
        where: { id },
    });

    if (!station) {
        throw new Error("Station not found");
    }

    return await prisma.station.update({
        where: { id },

        data: {
            ...(data.name !== undefined && {
                name: data.name,
            }),

            ...(data.type !== undefined && {
                type: data.type,
            }),

            ...(data.provinceId !== undefined && {
                provinceId: data.provinceId,
            }),

            ...(data.districtId !== undefined && {
                districtId: data.districtId,
            }),

            ...(data.communeId !== undefined && {
                communeId: data.communeId,
            }),

            ...(data.address !== undefined && {
                address: data.address,
            }),

            ...(data.hotline !== undefined && {
                hotline: data.hotline,
            }),

            ...(data.lat !== undefined && {
                lat: data.lat,
            }),

            ...(data.lng !== undefined && {
                lng: data.lng,
            }),

            ...(data.capacity !== undefined && {
                capacity: data.capacity,
            }),

            ...(data.organizationId !== undefined && {
                organizationId: data.organizationId,
            }),

            ...(data.status !== undefined && {
                status: data.status,
            }),
        },

        include: {
            province: true,
            district: true,
            commune: true,
            organization: true,
        },
    });
};

// ==========================================
// Delete station
// ==========================================

const deleteStation = async (id) => {
    const station = await prisma.station.findUnique({
        where: { id },
    });

    if (!station) {
        throw new Error("Station not found");
    }

    return await prisma.station.delete({
        where: { id },
    });
};

// ==========================================
// Change station status
// ==========================================

const updateStationStatus = async (id, status) => {
    const station = await prisma.station.findUnique({
        where: { id },
    });

    if (!station) {
        throw new Error("Station not found");
    }

    return await prisma.station.update({
        where: { id },

        data: {
            status,
        },

        include: {
            province: true,
            district: true,
            commune: true,
            organization: true,
        },
    });
};

module.exports = {
    getAllStations,
    getStationById,
    createStation,
    updateStation,
    deleteStation,
    updateStationStatus,
};