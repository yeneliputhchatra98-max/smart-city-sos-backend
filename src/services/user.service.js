const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");
const { deleteOldFile, getStoredPath } = require("../middleware/upload.middleware");

// ✅ Import constants
const {
    DEFAULT_AVATAR,
    DEFAULT_BADGE,
    VALID_USER_STATUSES,
} = require("../utils/constants");

const prisma = new PrismaClient();

const USER_FIELDS = [
    "fullName","username","email","phone","avatar",
    "birthday","gender","roleId","organizationId","badgeId","password","mfaEnabled","status",
];

// ✅ ប្រើ VALID_USER_STATUSES ពី constants
const VALID_STATUSES = VALID_USER_STATUSES;

const fail = (msg, status = 400) => {
    const e = new Error(msg); e.status = status; throw e;
};

const pickFields = (body) => {
    const d = {};
    for (const k of USER_FIELDS) if (body[k] !== undefined) d[k] = body[k];
    return d;
};

const normalizeNullable = (d) => {
    // Fields nullable → set null
    for (const k of ["birthday","gender","roleId","organizationId","username","phone"]) {
        if (d[k] === "") d[k] = null;
    }

    // ✅ Fields required → set default
    if (d.badgeId === "" || d.badgeId === null) d.badgeId = DEFAULT_BADGE;
    if (d.avatar === "" || d.avatar === null) d.avatar = DEFAULT_AVATAR;
};

const parseDate = (v) => {
    const dt = new Date(v);
    if (isNaN(dt.getTime())) fail("Invalid date format");
    return dt;
};

const parseId = (v, label) => {
    const n = Number(v);
    if (Number.isNaN(n)) fail(`Invalid ${label}`);
    return n;
};

const transformCommon = async (d) => {
    if (d.password === "" || d.password === null) delete d.password;
    else if (d.password) d.password = await bcrypt.hash(d.password, 10);

    if (d.birthday) d.birthday = parseDate(d.birthday);
    if (d.roleId != null && d.roleId !== "") d.roleId = parseId(d.roleId, "roleId");
};

// ============ GET ALL ============
exports.getAllUsers = async ({ page = 1, limit = 20, role, unassignedOnly = false, all = false } = {}) => {
    const where = { deletedAt: null };

    // ✅ Filter តាម Role Name (ឧ. "AGENT", "ADMIN", "OPERATOR")
    if (role) {
        where.role = {
            name: String(role).toUpperCase(),
        };
    }

    // ✅ Filter យកតែ User ដែលមិនទាន់ភ្ជាប់ Agent
    if (unassignedOnly) {
        where.agentProfile = null;
    }

    // ប្រសិនបើសុំយកទាំងអស់ (សម្រាប់ Dropdown ឬ User Management)
    if (all) {
        const data = await prisma.user.findMany({
            where,
            include: { role: true, organization: true, agentProfile: { include: { organization: true, station: true } } },
            orderBy: { createdAt: "desc" },
        });
        return { data, total: data.length, page: 1, limit: data.length };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
        prisma.user.findMany({
            where,
            include: { role: true, organization: true, agentProfile: { include: { organization: true, station: true } } },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
};

// ============ GET AGENT CANDIDATES (Role = AGENT) ============
// API សម្រាប់ទាញយក User ដែលមាន Role = "AGENT" សម្រាប់បំពេញ Dropdown
exports.getAgentCandidateUsers = async ({ unassignedOnly = false } = {}) => {
    const where = {
        deletedAt: null,
    };

    if (unassignedOnly) {
        where.agentProfile = null;
    } else {
        where.OR = [
            { role: { name: "AGENT" } },
            { agentProfile: null }
        ];
    }

    return await prisma.user.findMany({
        where,
        include: {
            role: true,
            organization: true,
            agentProfile: true,
        },
        orderBy: { fullName: "asc" },
    });
};

// ============ GET DELETED ============
exports.getDeletedUsers = async () => {
    return await prisma.user.findMany({
        where: { deletedAt: { not: null } },
        include: { role: true, organization: true },
        orderBy: { deletedAt: "desc" },
    });
};

// ============ GET BY ID ============
exports.getUserById = async (id) => {
    return await prisma.user.findFirst({
        where: { id, deletedAt: null },
        include: { role: true, organization: true },
    });
};

// ============ CREATE ============
exports.createUser = async (body, file = null) => {
    const d = pickFields(body);
    normalizeNullable(d);
    await transformCommon(d);

    if (!d.email) fail("Email is required");
    if (!d.fullName) fail("fullName is required");

    // ✅ Validate roleId if provided
    if (d.roleId) {
        const targetRole = await prisma.role.findUnique({ where: { id: d.roleId } });
        if (!targetRole) fail("Invalid roleId", 400);
    }

    // ✅ Handle file upload
    if (file) {
        d.avatar = getStoredPath(file);
    }

    if (d.username) {
        const dup = await prisma.user.findUnique({ where: { username: d.username } });
        if (dup) {
            if (!dup.deletedAt) fail("Username already exists", 409);
            // Free username from soft-deleted user
            await prisma.user.update({
                where: { id: dup.id },
                data: { username: `${dup.username}.deleted.${Date.now()}` },
            });
        }
    }

    const dupEmail = await prisma.user.findUnique({ where: { email: d.email } });
    if (dupEmail) {
        if (!dupEmail.deletedAt) fail("Email already exists", 409);
        // Free email from soft-deleted user
        await prisma.user.update({
            where: { id: dupEmail.id },
            data: { email: `${dupEmail.email}.deleted.${Date.now()}` },
        });
    }

    return await prisma.user.create({
        data: d,
        include: { role: true, organization: true },
    });
};

// ============ UPDATE ============
exports.updateUser = async (id, body, file = null) => {
    const existing = await prisma.user.findFirst({
        where: { id, deletedAt: null },
        include: { role: true, agentProfile: true },
    });
    if (!existing) fail("User not found", 404);

    const d = pickFields(body);
    normalizeNullable(d);
    await transformCommon(d);

    // ✅ Validate roleId if provided
    if (d.roleId) {
        const targetRole = await prisma.role.findUnique({ where: { id: d.roleId } });
        if (!targetRole) fail("Invalid roleId", 400);
    }

    // ✅ Handle file upload
    if (file) {
        if (existing.avatar) deleteOldFile(existing.avatar);
        d.avatar = getStoredPath(file);
    }

    if (d.username) {
        const dup = await prisma.user.findFirst({
            where: { username: d.username, NOT: { id }, deletedAt: null },
        });
        if (dup) fail("Username already exists", 409);
    }
    if (d.email) {
        const dup = await prisma.user.findFirst({
            where: { email: d.email, NOT: { id }, deletedAt: null },
        });
        if (dup) fail("Email already exists", 409);
    }

    // ✅ Use prisma.$transaction to update both User and Agent (if any) for synchronization
    return await prisma.$transaction(async (tx) => {
        const updatedUser = await tx.user.update({
            where: { id },
            data: d,
            include: { role: true, organization: true, agentProfile: { include: { organization: true, station: true } } },
        });

        // Keep Agent profile fields in sync with User updates
        if (existing.agentProfile) {
            const agentSyncData = {};
            if (d.fullName !== undefined) agentSyncData.name = d.fullName;
            if (d.phone !== undefined) agentSyncData.phone = d.phone;
            if (d.email !== undefined) agentSyncData.email = d.email;
            if (d.organizationId !== undefined) agentSyncData.organizationId = d.organizationId;

            if (Object.keys(agentSyncData).length > 0) {
                await tx.agent.update({
                    where: { id: existing.agentProfile.id },
                    data: agentSyncData,
                });
            }
        }

        return updatedUser;
    });
};

// ============ DELETE (soft) ============
exports.deleteUser = async (id) => {
    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) fail("User not found or already deleted", 404);

    const deletedSuffix = `.deleted.${Date.now()}`;
    const newEmail = `${existing.email}${deletedSuffix}`;
    const newUsername = existing.username ? `${existing.username}${deletedSuffix}` : null;

    // ✅ Transaction: soft delete + revoke refresh tokens + free unique email/username
    const [user] = await prisma.$transaction([
        prisma.user.update({
            where: { id },
            data: {
                deletedAt: new Date(),
                status: "DELETED",
                email: newEmail,
                username: newUsername,
            },
        }),
        prisma.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
        }),
    ]);

    // ✅ Sync: If this user is linked to an Agent profile, also delete the Agent profile
    try {
        const linkedAgent = await prisma.agent.findUnique({ where: { userId: id } });
        if (linkedAgent) {
            await prisma.agent.delete({ where: { id: linkedAgent.id } });
            if (linkedAgent.organizationId || linkedAgent.stationId) {
                const { recalculateVehicleCounts } = require("./vehicle.service");
                await recalculateVehicleCounts({
                    organizationId: linkedAgent.organizationId,
                    stationId: linkedAgent.stationId,
                });
            }
        }
    } catch (err) {
        console.warn(`Could not sync delete linked agent for user ${id}:`, err);
    }

    // ✅ លុប avatar file ក្រោយ transaction ជោគជ័យ
    if (existing.avatar && existing.avatar !== DEFAULT_AVATAR) {
        deleteOldFile(existing.avatar);
    }

    return user;
};

// ============ RESTORE ============
exports.restoreUser = async (id) => {
    const existing = await prisma.user.findFirst({
        where: { id, deletedAt: { not: null } },
    });
    if (!existing) fail("User not found or not deleted", 404);

    return await prisma.user.update({
        where: { id },
        data: { deletedAt: null, status: "ACTIVE" },
        include: { role: true, organization: true },
    });
};

// ============ STATUS ============
exports.setStatus = async (id, status) => {
    if (!VALID_STATUSES.includes(status)) fail("Invalid status");

    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) fail("User not found", 404);

    return await prisma.user.update({
        where: { id },
        data: { status },
        include: { role: true, organization: true },
    });
};

exports.blockUser   = (id) => exports.setStatus(id, "BLOCKED");
exports.unblockUser = (id) => exports.setStatus(id, "ACTIVE");