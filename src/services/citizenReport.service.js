const { PrismaClient } = require("@prisma/client");

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
        where.status = status;
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

    return {
        reports,
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

    return report;
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

    const updatedReport =
        await prisma.citizenReport.update({
            where: {
                id,
            },
            data: {
                status,
            },
        });

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

    return {
        message: "Citizen report deleted successfully",
    };
};