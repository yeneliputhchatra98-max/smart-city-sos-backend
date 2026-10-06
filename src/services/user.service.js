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
    "birthday","gender","roleId","organizationId","badgeId","password",
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
exports.getAllUsers = async ({ page = 1, limit = 20 } = {}) => {
    const skip = (page - 1) * limit;
    const where = { deletedAt: null };

    const [data, total] = await Promise.all([
        prisma.user.findMany({
            where,
            include: { role: true, organization: true },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.user.count({ where }),
    ]);

    return { data, total, page, limit };
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

    // ✅ Handle file upload
    if (file) {
        d.avatar = getStoredPath(file);
    }

    if (d.username) {
        const dup = await prisma.user.findUnique({ where: { username: d.username } });
        if (dup && !dup.deletedAt) fail("Username already exists", 409);
    }

    const dupEmail = await prisma.user.findUnique({ where: { email: d.email } });
    if (dupEmail && !dupEmail.deletedAt) fail("Email already exists", 409);

    return await prisma.user.create({
        data: d,
        include: { role: true, organization: true },
    });
};

// ============ UPDATE ============
exports.updateUser = async (id, body, file = null) => {
    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) fail("User not found", 404);

    const d = pickFields(body);
    normalizeNullable(d);
    await transformCommon(d);

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

    return await prisma.user.update({
        where: { id },
        data: d,
        include: { role: true, organization: true },
    });
};

// ============ DELETE (soft) ============
exports.deleteUser = async (id) => {
    const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
    if (!existing) fail("User not found or already deleted", 404);

    // ✅ Transaction: soft delete + revoke refresh tokens
    const [user] = await prisma.$transaction([
        prisma.user.update({
            where: { id },
            data: { deletedAt: new Date(), status: "DELETED" },
        }),
        prisma.refreshToken.updateMany({
            where: { userId: id, revokedAt: null },
            data: { revokedAt: new Date() },
        }),
    ]);

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