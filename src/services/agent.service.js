const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ─── Get all ──────────────────────────────────────
const getAllAgents = async () => {
    return await prisma.agent.findMany({
        include: {
            organization: true,
            station: true,
            assignedVehicle: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
};

// ─── Get by id ────────────────────────────────────
const getAgentById = async (id) => {
    return await prisma.agent.findUnique({
        where: { id },
        include: {
            organization: true,
            station: true,
            assignedVehicle: true,
        },
    });
};

// ─── Create ───────────────────────────────────────
const createAgent = async (data) => {
    return await prisma.agent.create({
        data,
        include: {
            organization: true,
            station: true,
            assignedVehicle: true,
        },
    });
};

// ─── Update ───────────────────────────────────────
const updateAgent = async (id, data) => {
    const updated = await prisma.agent.update({
        where: { id },
        data,
        include: {
            organization: true,
            station: true,
            assignedVehicle: true,
        },
    });

    try {
        const { recalculateVehicleCounts } = require("./vehicle.service");
        await recalculateVehicleCounts({
            organizationId: updated.organizationId,
            stationId: updated.stationId,
        });
    } catch {
        // Safe fallback
    }

    return updated;
};

// ─── Update status ────────────────────────────────
const updateAgentStatus = async (id, status) => {
    const updated = await prisma.agent.update({
        where: { id },
        data: { status },
        include: {
            organization: true,
            station: true,
            assignedVehicle: true,
        },
    });

    try {
        const { recalculateVehicleCounts } = require("./vehicle.service");
        await recalculateVehicleCounts({
            organizationId: updated.organizationId,
            stationId: updated.stationId,
        });
    } catch {
        // Safe fallback
    }

    return updated;
};

// ─── Delete ───────────────────────────────────────
const deleteAgent = async (id) => {
    const agent = await prisma.agent.findUnique({
        where: { id },
        select: { organizationId: true, stationId: true },
    });

    const deleted = await prisma.agent.delete({
        where: { id },
    });

    if (agent) {
        try {
            const { recalculateVehicleCounts } = require("./vehicle.service");
            await recalculateVehicleCounts({
                organizationId: agent.organizationId,
                stationId: agent.stationId,
            });
        } catch {
            // Safe fallback
        }
    }

    return deleted;
};

module.exports = {
    getAllAgents,
    getAgentById,
    createAgent,
    updateAgent,
    updateAgentStatus,
    deleteAgent,
};