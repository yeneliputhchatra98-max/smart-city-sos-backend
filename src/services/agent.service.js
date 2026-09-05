const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Get all
const getAllAgents = async () => {
    return await prisma.agent.findMany({
        include: {
            organization: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    });
};

// Get by id
const getAgentById = async (id) => {
    return await prisma.agent.findUnique({
        where: { id },
        include: {
            organization: true,
        },
    });
};

// Create
const createAgent = async (data) => {
    return await prisma.agent.create({
        data,
    });
};

// Update
const updateAgent = async (id, data) => {
    return await prisma.agent.update({
        where: { id },
        data,
    });
};

// Update status
const updateAgentStatus = async (id, status) => {
    return await prisma.agent.update({
        where: { id },
        data: { status },
    });
};

// Delete
const deleteAgent = async (id) => {
    return await prisma.agent.delete({
        where: { id },
    });
};

module.exports = {
    getAllAgents,
    getAgentById,
    createAgent,
    updateAgent,
    updateAgentStatus,
    deleteAgent,
};