const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// =============================
// Get All Organizations
// =============================
exports.getAllOrgs = async () => {

    return await prisma.organization.findMany({

        include: {
            _count: {
                select: {
                    agents: true,
                    stations: true,
                    users: true
                }
            }
        },

        orderBy: {
            createdAt: "desc"
        }

    });

};

// =============================
// Create Organization
// =============================
exports.createOrg = async (data) => {

    const {
        name,
        type,
        hotline,
        head,
        address,
        accessLevel,
        gpsLat,
        gpsLng
    } = data;

    if (!name) {
        throw new Error("Organization name is required");
    }

    const existOrg = await prisma.organization.findFirst({
        where: {
            name: name.trim()
        }
    });

    if (existOrg) {
        throw new Error("Organization already exists");
    }

    return await prisma.organization.create({

        data: {

            name: name.trim(),

            type: type
                ? type.toUpperCase()
                : "POLICE",

            hotline,

            head,

            address,

            accessLevel: accessLevel
                ? accessLevel.toUpperCase()
                : "STANDARD",

            gpsLat: gpsLat
                ? Number(gpsLat)
                : null,

            gpsLng: gpsLng
                ? Number(gpsLng)
                : null

        }

    });

};

// =============================
// Update Organization
// =============================
exports.updateOrg = async (id, data) => {

    const org = await prisma.organization.findUnique({

        where: {
            id: Number(id)
        }

    });

    if (!org) {
        throw new Error("Organization not found");
    }

    return await prisma.organization.update({

        where: {
            id: Number(id)
        },

        data: {

            name: data.name,

            hotline: data.hotline,

            head: data.head,

            address: data.address,

            status: data.status
                ? data.status.toUpperCase()
                : undefined,

            accessLevel: data.accessLevel
                ? data.accessLevel.toUpperCase()
                : undefined,

            gpsLat: data.gpsLat
                ? Number(data.gpsLat)
                : undefined,

            gpsLng: data.gpsLng
                ? Number(data.gpsLng)
                : undefined

        }

    });

};

// =============================
// Delete Organization
// =============================
exports.deleteOrg = async (id) => {

    const org = await prisma.organization.findUnique({

        where: {
            id: Number(id)
        },

        include: {
            _count: {
                select: {
                    agents: true,
                    stations: true,
                    users: true
                }
            }
        }

    });

    if (!org) {
        throw new Error("Organization not found");
    }

    if (
        org._count.agents > 0 ||
        org._count.stations > 0 ||
        org._count.users > 0
    ) {
        throw new Error(
            "Organization still has related data."
        );
    }

    return await prisma.organization.delete({

        where: {
            id: Number(id)
        }

    });

};

exports.getOrgById = async (id) => {

    const org = await prisma.organization.findUnique({

        where: {
            id: Number(id)
        },

        include: {
            _count: {
                select: {
                    agents: true,
                    stations: true,
                    users: true
                }
            }
        }

    });

    if (!org) {
        throw new Error("Organization not found");
    }

    return org;
};