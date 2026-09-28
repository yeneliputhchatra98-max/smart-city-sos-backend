const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// =============================
// Helper: Calculate activeVehiclesCount from agents
// =============================
function calculateActiveVehicles(agents) {
    if (!Array.isArray(agents)) return 0;
    return agents.filter(a => a.vehicleNo != null && a.vehicleNo !== '').length;
}

// =============================
// Get All Organizations
// =============================
exports.getAllOrgs = async () => {
    const orgs = await prisma.organization.findMany({
        include: {
            stations: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    address: true,
                    hotline: true,
                    status: true
                }
            },
            // ✅ បន្ថែម — Agents ដែលមានយានជំនិះ
            agents: {
                where: {
                    vehicleNo: { not: null }
                },
                select: {
                    id: true,
                    name: true,
                    vehicleNo: true,
                    vehicleType: true
                }
            },
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

    // ✅ គណនា activeVehiclesCount ពី Agents
    return orgs.map(o => ({
        ...o,
        activeVehiclesCount: calculateActiveVehicles(o.agents),
        activeAgentsCount: o._count.agents,
    }));
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

    const org = await prisma.organization.create({
        data: {
            name: name.trim(),
            type: type ? type.toUpperCase() : "POLICE",
            hotline,
            head,
            address,
            accessLevel: accessLevel ? accessLevel.toUpperCase() : "STANDARD",
            gpsLat: gpsLat ? Number(gpsLat) : null,
            gpsLng: gpsLng ? Number(gpsLng) : null
        },
        include: {
            stations: {
                select: {
                    id: true,
                    name: true,
                    type: true
                }
            },
            agents: {
                where: {
                    vehicleNo: { not: null }
                },
                select: {
                    id: true,
                    name: true,
                    vehicleNo: true,
                    vehicleType: true
                }
            },
            _count: {
                select: {
                    agents: true,
                    stations: true,
                    users: true
                }
            }
        }
    });

    // ✅ គណនា
    return {
        ...org,
        activeVehiclesCount: calculateActiveVehicles(org.agents),
        activeAgentsCount: org._count.agents,
    };
};

// =============================
// Update Organization
// =============================
exports.updateOrg = async (id, data) => {
    const org = await prisma.organization.findUnique({
        where: { id: id }
    });

    if (!org) {
        throw new Error("Organization not found");
    }

    const updated = await prisma.organization.update({
        where: { id: id },
        data: {
            name: data.name,
            hotline: data.hotline,
            head: data.head,
            address: data.address,
            status: data.status ? data.status.toUpperCase() : undefined,
            accessLevel: data.accessLevel ? data.accessLevel.toUpperCase() : undefined,
            gpsLat: data.gpsLat ? Number(data.gpsLat) : undefined,
            gpsLng: data.gpsLng ? Number(data.gpsLng) : undefined
        },
        include: {
            stations: {
                select: {
                    id: true,
                    name: true,
                    type: true
                }
            },
            agents: {
                where: {
                    vehicleNo: { not: null }
                },
                select: {
                    id: true,
                    name: true,
                    vehicleNo: true,
                    vehicleType: true
                }
            },
            _count: {
                select: {
                    agents: true,
                    stations: true,
                    users: true
                }
            }
        }
    });

    // ✅ គណនា
    return {
        ...updated,
        activeVehiclesCount: calculateActiveVehicles(updated.agents),
        activeAgentsCount: updated._count.agents,
    };
};

// =============================
// Delete Organization
// =============================
exports.deleteOrg = async (id) => {
    const org = await prisma.organization.findUnique({
        where: { id: id },
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
        throw new Error("Organization still has related data.");
    }

    return await prisma.organization.delete({
        where: { id: id }
    });
};

// =============================
// Get Organization By ID
// =============================
exports.getOrgById = async (id) => {
    const org = await prisma.organization.findUnique({
        where: { id: id },
        include: {
            stations: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    address: true,
                    hotline: true,
                    status: true
                }
            },
            agents: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    phone: true,
                    status: true,
                    vehicleNo: true,
                    vehicleType: true
                }
            },
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

    // ✅ គណនា
    return {
        ...org,
        activeVehiclesCount: calculateActiveVehicles(org.agents),
        activeAgentsCount: org._count.agents,
    };
};

// =============================
// Update Organization Status
// =============================
exports.updateStatus = async (id, status) => {
    const org = await prisma.organization.findUnique({
        where: { id: id }
    });

    if (!org) {
        throw new Error("Organization not found");
    }

    const updated = await prisma.organization.update({
        where: { id: id },
        data: {
            status: status.toUpperCase()
        },
        include: {
            stations: {
                select: {
                    id: true,
                    name: true,
                    type: true
                }
            },
            agents: {
                where: {
                    vehicleNo: { not: null }
                },
                select: {
                    id: true,
                    name: true,
                    vehicleNo: true,
                    vehicleType: true
                }
            },
            _count: {
                select: {
                    agents: true,
                    stations: true,
                    users: true
                }
            }
        }
    });

    // ✅ គណនា
    return {
        ...updated,
        activeVehiclesCount: calculateActiveVehicles(updated.agents),
        activeAgentsCount: updated._count.agents,
    };
};