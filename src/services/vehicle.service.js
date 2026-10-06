const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const logger = require("../utils/logger");
const { emitVehicleUpdated, emitVehicleCountsChanged } = require("../socket");

/**
 * ─── Hierarchy Count Auto-Calculation Helper ─────────────────────────────────
 * Automatically recalculates and updates active vehicle counts across:
 * Organization → Station → Agent
 * Then broadcasts the real-time event via Socket.IO
 */
const recalculateVehicleCounts = async ({ organizationId, stationId }) => {
    try {
        const results = {};

        // 1. Recalculate for Organization
        if (organizationId) {
            const orgActiveCount = await prisma.vehicle.count({
                where: {
                    organizationId,
                    status: {
                        in: ["AVAILABLE", "ON_DUTY", "DISPATCHED"],
                    },
                },
            });

            await prisma.organization.update({
                where: { id: organizationId },
                data: { activeVehiclesCount: orgActiveCount },
            }).catch((err) => {
                logger.warn(`Could not update org activeVehiclesCount: ${err.message}`);
            });

            results.organizationId = organizationId;
            results.orgActiveVehicles = orgActiveCount;
        }

        // 2. Recalculate for Station
        if (stationId) {
            const stationActiveCount = await prisma.vehicle.count({
                where: {
                    stationId,
                    status: {
                        in: ["AVAILABLE", "ON_DUTY", "DISPATCHED"],
                    },
                },
            });

            await prisma.station.update({
                where: { id: stationId },
                data: { activeVehiclesCount: stationActiveCount },
            }).catch((err) => {
                logger.warn(`Could not update station activeVehiclesCount: ${err.message}`);
            });

            results.stationId = stationId;
            results.stationActiveVehicles = stationActiveCount;
        }

        // 3. Broadcast real-time hierarchy count update
        emitVehicleCountsChanged(results);

        return results;
    } catch (err) {
        logger.error(`Error in recalculateVehicleCounts: ${err.message}`);
        return null;
    }
};

/**
 * ─── Get All Vehicles with Filtering & Pagination ────────────────────────────
 */
const getAllVehicles = async (query = {}) => {
    const {
        type,
        status,
        organizationId,
        stationId,
        search,
        page = 1,
        limit = 50,
    } = query;

    const where = {};

    if (type && type !== "all") {
        where.type = type;
    }

    if (status && status !== "all") {
        where.status = status;
    }

    if (organizationId && organizationId !== "all") {
        where.organizationId = organizationId;
    }

    if (stationId && stationId !== "all") {
        where.stationId = stationId;
    }

    if (search && search.trim()) {
        const term = search.trim();
        where.OR = [
            { plateNumber: { contains: term } },
            { model: { contains: term } },
            { assignedAgent: { name: { contains: term } } },
            { station: { name: { contains: term } } },
            { organization: { name: { contains: term } } },
        ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);

    const [total, vehicles] = await Promise.all([
        prisma.vehicle.count({ where }),
        prisma.vehicle.findMany({
            where,
            include: {
                organization: {
                    select: { id: true, name: true, type: true, hotline: true },
                },
                station: {
                    select: { id: true, name: true, type: true, hotline: true, address: true },
                },
                assignedAgent: {
                    select: { id: true, name: true, role: true, phone: true, status: true, type: true },
                },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take,
        }),
    ]);

    return {
        vehicles,
        pagination: {
            total,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(total / take) || 1,
        },
    };
};

/**
 * ─── Get Single Vehicle by ID ────────────────────────────────────────────────
 */
const getVehicleById = async (id) => {
    return await prisma.vehicle.findUnique({
        where: { id },
        include: {
            organization: true,
            station: true,
            assignedAgent: true,
        },
    });
};

/**
 * ─── Get Fleet Dashboard Statistics ──────────────────────────────────────────
 */
const getVehicleStats = async () => {
    const allVehicles = await prisma.vehicle.findMany({
        select: {
            id: true,
            type: true,
            status: true,
            fuelLevel: true,
            organizationId: true,
            organization: {
                select: { type: true },
            },
        },
    });

    const total = allVehicles.length;
    const available = allVehicles.filter((v) => v.status === "AVAILABLE").length;
    const onDuty = allVehicles.filter((v) => v.status === "ON_DUTY" || v.status === "DISPATCHED").length;
    const maintenance = allVehicles.filter((v) => v.status === "MAINTENANCE").length;
    const outOfService = allVehicles.filter((v) => v.status === "OUT_OF_SERVICE").length;

    // Counts by agency/org type
    const policeCount = allVehicles.filter((v) => v.type === "POLICE_CAR" || v.organization?.type === "POLICE").length;
    const fireCount = allVehicles.filter((v) => v.type === "FIRE_TRUCK" || v.organization?.type === "FIRE").length;
    const medicalCount = allVehicles.filter((v) => v.type === "AMBULANCE" || v.organization?.type === "MEDICAL").length;

    // Fuel calculation
    const totalFuel = allVehicles.reduce((acc, curr) => acc + (curr.fuelLevel || 100), 0);
    const avgFuel = total > 0 ? Math.round(totalFuel / total) : 100;

    // Readiness rate = (available + onDuty) / total * 100
    const readinessRate = total > 0 ? Math.round(((available + onDuty) / total) * 100) : 100;

    return {
        total,
        available,
        onDuty,
        maintenance,
        outOfService,
        policeCount,
        fireCount,
        medicalCount,
        avgFuel,
        readinessRate,
    };
};

/**
 * ─── Create New Vehicle ──────────────────────────────────────────────────────
 */
const createVehicle = async (data) => {
    // If assigned to an agent, sync the agent's vehicleNo & vehicleType
    const created = await prisma.vehicle.create({
        data,
        include: {
            organization: true,
            station: true,
            assignedAgent: true,
        },
    });

    if (created.assignedAgentId) {
        await prisma.agent.update({
            where: { id: created.assignedAgentId },
            data: {
                vehicleNo: created.plateNumber,
                vehicleType: created.type,
            },
        }).catch((err) => {
            logger.warn(`Could not sync vehicle to agent: ${err.message}`);
        });
    }

    // Trigger hierarchy counts
    await recalculateVehicleCounts({
        organizationId: created.organizationId,
        stationId: created.stationId,
    });

    emitVehicleUpdated(created);

    return created;
};

/**
 * ─── Update Vehicle ──────────────────────────────────────────────────────────
 */
const updateVehicle = async (id, data) => {
    const existing = await prisma.vehicle.findUnique({
        where: { id },
        select: {
            organizationId: true,
            stationId: true,
            assignedAgentId: true,
            plateNumber: true,
            type: true,
        },
    });

    if (!existing) {
        throw new Error("Vehicle not found");
    }

    const updated = await prisma.vehicle.update({
        where: { id },
        data,
        include: {
            organization: true,
            station: true,
            assignedAgent: true,
        },
    });

    // If agent assignment changed
    if (existing.assignedAgentId && existing.assignedAgentId !== updated.assignedAgentId) {
        // Clear old agent's vehicle info
        await prisma.agent.update({
            where: { id: existing.assignedAgentId },
            data: { vehicleNo: null, vehicleType: null },
        }).catch(() => {});
    }

    if (updated.assignedAgentId) {
        // Sync new agent's vehicle info
        await prisma.agent.update({
            where: { id: updated.assignedAgentId },
            data: {
                vehicleNo: updated.plateNumber,
                vehicleType: updated.type,
            },
        }).catch(() => {});
    }

    // Recalculate for both old and new org/station if changed
    const orgsToUpdate = new Set([existing.organizationId, updated.organizationId].filter(Boolean));
    const stationsToUpdate = new Set([existing.stationId, updated.stationId].filter(Boolean));

    for (const orgId of orgsToUpdate) {
        await recalculateVehicleCounts({ organizationId: orgId });
    }
    for (const stId of stationsToUpdate) {
        await recalculateVehicleCounts({ stationId: stId });
    }

    emitVehicleUpdated(updated);

    return updated;
};

/**
 * ─── Update Vehicle Status ───────────────────────────────────────────────────
 */
const updateVehicleStatus = async (id, status) => {
    const vehicle = await prisma.vehicle.findUnique({
        where: { id },
        select: { organizationId: true, stationId: true },
    });

    if (!vehicle) {
        throw new Error("Vehicle not found");
    }

    const updated = await prisma.vehicle.update({
        where: { id },
        data: { status },
        include: {
            organization: true,
            station: true,
            assignedAgent: true,
        },
    });

    await recalculateVehicleCounts({
        organizationId: vehicle.organizationId,
        stationId: vehicle.stationId,
    });

    emitVehicleUpdated(updated);

    return updated;
};

/**
 * ─── Assign Vehicle to Agent / Station / Organization ────────────────────────
 */
const assignVehicle = async (id, { agentId, stationId, organizationId }) => {
    const vehicle = await prisma.vehicle.findUnique({
        where: { id },
    });

    if (!vehicle) {
        throw new Error("Vehicle not found");
    }

    const updateData = {};
    if (agentId !== undefined) {
        updateData.assignedAgentId = agentId || null;
    }
    if (stationId !== undefined) {
        updateData.stationId = stationId || null;
    }
    if (organizationId !== undefined) {
        updateData.organizationId = organizationId || null;
    }

    const updated = await prisma.vehicle.update({
        where: { id },
        data: updateData,
        include: {
            organization: true,
            station: true,
            assignedAgent: true,
        },
    });

    // Sync agent vehicle details
    if (agentId) {
        await prisma.agent.update({
            where: { id: agentId },
            data: {
                vehicleNo: updated.plateNumber,
                vehicleType: updated.type,
                stationId: updated.stationId || undefined,
            },
        }).catch(() => {});
    }

    await recalculateVehicleCounts({
        organizationId: updated.organizationId,
        stationId: updated.stationId,
    });

    emitVehicleUpdated(updated);

    return updated;
};

/**
 * ─── Delete Vehicle ──────────────────────────────────────────────────────────
 */
const deleteVehicle = async (id) => {
    const vehicle = await prisma.vehicle.findUnique({
        where: { id },
        select: {
            organizationId: true,
            stationId: true,
            assignedAgentId: true,
        },
    });

    if (!vehicle) {
        throw new Error("Vehicle not found");
    }

    if (vehicle.assignedAgentId) {
        await prisma.agent.update({
            where: { id: vehicle.assignedAgentId },
            data: { vehicleNo: null, vehicleType: null },
        }).catch(() => {});
    }

    const deleted = await prisma.vehicle.delete({
        where: { id },
    });

    await recalculateVehicleCounts({
        organizationId: vehicle.organizationId,
        stationId: vehicle.stationId,
    });

    return deleted;
};

module.exports = {
    getAllVehicles,
    getVehicleById,
    getVehicleStats,
    createVehicle,
    updateVehicle,
    updateVehicleStatus,
    assignVehicle,
    deleteVehicle,
    recalculateVehicleCounts,
};
