const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// ─── Standard Agent Include ───────────────────────
const agentInclude = {
    organization: true,
    station: true,
    assignedVehicle: true,
    user: {
        select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            badgeId: true,
            avatar: true,
            username: true,
            roleId: true,
            role: true,
        },
    },
};

// ─── Get all ──────────────────────────────────────
const getAllAgents = async () => {
    return await prisma.agent.findMany({
        include: agentInclude,
        orderBy: {
            createdAt: 'desc',
        },
    });
};

// ─── Get by id ────────────────────────────────────
const getAgentById = async (id) => {
    return await prisma.agent.findUnique({
        where: { id },
        include: agentInclude,
    });
};

// ─── Sanitizer Helper ─────────────────────────────
const sanitizeAgentData = (data) => {
    const clean = { ...data };
    if (clean.userId === '') clean.userId = null;
    if (clean.stationId === '') clean.stationId = null;
    if (clean.organizationId === '') clean.organizationId = null;
    if (clean.vehicleType === '') clean.vehicleType = null;
    if (clean.vehicleNo === '') clean.vehicleNo = null;
    if (clean.email === '') clean.email = null;
    if (clean.role === '') clean.role = 'Responder';
    return clean;
};

// ─── Create ───────────────────────────────────────
const createAgent = async (data) => {
    const cleanData = sanitizeAgentData(data);

    // ✅ សេណារីយ៉ូទី ១: បង្កើត User Account ស្វ័យប្រវត្តិ (Role = AGENT) និង Agent Profile ក្នុង Transaction តែមួយ
    if (data.email && data.password) {
        const cleanEmail = String(data.email).trim().toLowerCase();

        // 1. ពិនិត្យ Email ស្ទួនលើ Active User
        const existingActiveUser = await prisma.user.findFirst({
            where: { email: cleanEmail, deletedAt: null },
        });
        if (existingActiveUser) {
            const error = new Error("User account with this email already exists");
            error.status = 409;
            throw error;
        }

        // ដោះលែង unique constraint លើ soft-deleted user បើមាន email ដូចគ្នា
        const softDeletedUser = await prisma.user.findFirst({
            where: { email: cleanEmail, deletedAt: { not: null } },
        });
        if (softDeletedUser) {
            await prisma.user.update({
                where: { id: softDeletedUser.id },
                data: { email: `${cleanEmail}.deleted.${Date.now()}` },
            });
        }

        // 2. ស្វែងរក Role = AGENT
        let agentRole = await prisma.role.findFirst({
            where: { name: "AGENT" },
        });
        const roleId = agentRole ? agentRole.id : 3;

        // 3. Hash Password & បង្កើត Username / Badge ID
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const usernameBase = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "");
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        let username = `${usernameBase}_${randomSuffix}`;
        let badgeId = `AGENT-${randomSuffix}`;

        // ពិនិត្យ username ស្ទួនលើ soft-deleted user
        const softDeletedUsername = await prisma.user.findFirst({
            where: { username, deletedAt: { not: null } },
        });
        if (softDeletedUsername) {
            await prisma.user.update({
                where: { id: softDeletedUsername.id },
                data: { username: `${username}.deleted.${Date.now()}` },
            });
        }

        // 4. បង្កើត User Account និង Agent Profile ក្នុង Transaction តែមួយ
        const createdAgent = await prisma.$transaction(async (tx) => {
            const newUser = await tx.user.create({
                data: {
                    fullName: cleanData.name,
                    username,
                    email: cleanEmail,
                    password: hashedPassword,
                    phone: cleanData.phone,
                    badgeId,
                    roleId,
                    organizationId: cleanData.organizationId || null,
                    status: "ACTIVE",
                },
            });

            const { password, ...agentPayload } = cleanData;
            agentPayload.userId = newUser.id;
            agentPayload.email = cleanEmail;

            return await tx.agent.create({
                data: agentPayload,
                include: agentInclude,
            });
        });

        try {
            const { recalculateVehicleCounts } = require("./vehicle.service");
            await recalculateVehicleCounts({
                organizationId: createdAgent.organizationId,
                stationId: createdAgent.stationId,
            });
        } catch {
            // Safe fallback
        }

        return createdAgent;
    }

    // ✅ សេណារីយ៉ូទី ២: ភ្ជាប់ជាមួយ User Account ដែលមានស្រាប់
    if (cleanData.userId) {
        const targetUser = await prisma.user.findFirst({
            where: { id: cleanData.userId, deletedAt: null },
            include: { role: true },
        });

        if (!targetUser) {
            const error = new Error("User account not found or has been deleted");
            error.status = 404;
            throw error;
        }

        if (targetUser.role?.name && targetUser.role.name !== "AGENT") {
            const error = new Error("Selected user account must have Role = AGENT");
            error.status = 400;
            throw error;
        }

        const existingAgent = await prisma.agent.findUnique({
            where: { userId: cleanData.userId },
        });

        if (existingAgent) {
            const error = new Error("This user account is already linked to another agent");
            error.status = 409;
            throw error;
        }

        const { password, ...agentPayload } = cleanData;
        const createdAgent = await prisma.agent.create({
            data: agentPayload,
            include: agentInclude,
        });

        try {
            const { recalculateVehicleCounts } = require("./vehicle.service");
            await recalculateVehicleCounts({
                organizationId: createdAgent.organizationId,
                stationId: createdAgent.stationId,
            });
        } catch {
            // Safe fallback
        }

        return createdAgent;
    }

    // ❌ ប្រសិនបើគ្មាន userId ហើយក៏គ្មាន email + password → មិនអនុញ្ញាតបង្កើត Agent ដោយគ្មាន User Account ទេ
    const error = new Error("Email and password are required to create the agent login account (or select an existing AGENT user).");
    error.status = 400;
    throw error;
};

// ─── Update ───────────────────────────────────────
const updateAgent = async (id, data) => {
    const cleanData = sanitizeAgentData(data);

    // ✅ ពិនិត្យ userId ពេល update
    if (cleanData.userId) {
        const targetUser = await prisma.user.findFirst({
            where: { id: cleanData.userId, deletedAt: null },
            include: { role: true },
        });

        if (!targetUser) {
            const error = new Error("User account not found or has been deleted");
            error.status = 404;
            throw error;
        }

        if (targetUser.role?.name && targetUser.role.name !== "AGENT") {
            const error = new Error("Selected user account must have Role = AGENT");
            error.status = 400;
            throw error;
        }

        const existingAgent = await prisma.agent.findFirst({
            where: {
                userId: cleanData.userId,
                NOT: { id },
            },
        });

        if (existingAgent) {
            const error = new Error("This user account is already linked to another agent");
            error.status = 409;
            throw error;
        }
    }

    const { password, ...agentPayload } = cleanData;

    // ✅ Update Agent និង sync ទៅ User Account ក្នុង Transaction តែមួយ
    const updated = await prisma.$transaction(async (tx) => {
        const ag = await tx.agent.update({
            where: { id },
            data: agentPayload,
            include: agentInclude,
        });

        if (ag.userId) {
            const userSync = {};
            if (cleanData.name) userSync.fullName = cleanData.name;
            if (cleanData.phone) userSync.phone = cleanData.phone;
            if (cleanData.email) userSync.email = cleanData.email;
            if (cleanData.organizationId !== undefined) userSync.organizationId = cleanData.organizationId;

            if (Object.keys(userSync).length > 0) {
                await tx.user.update({
                    where: { id: ag.userId },
                    data: userSync,
                });
            }
        }

        return ag;
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
        include: agentInclude,
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