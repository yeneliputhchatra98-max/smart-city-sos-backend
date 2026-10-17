const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_GRID = {
    admin: {
        view_map: true,
        dispatch: true,
        broadcast: true,
        manage_users: true,
        manage_orgs: true,
        publish_news: true,
        export_reports: true,
        system_settings: true,
    },
    operator: {
        view_map: true,
        dispatch: true,
        broadcast: true,
        manage_users: false,
        manage_orgs: false,
        publish_news: true,
        export_reports: true,
        system_settings: false,
    },
    agent: {
        view_map: true,
        dispatch: true,
        broadcast: false,
        manage_users: false,
        manage_orgs: false,
        publish_news: false,
        export_reports: false,
        system_settings: false,
    },
    citizen: {
        view_map: false,
        dispatch: false,
        broadcast: false,
        manage_users: false,
        manage_orgs: false,
        publish_news: false,
        export_reports: false,
        system_settings: false,
    },
};

// Map frontend role keys to DB Role names
const FRONTEND_TO_DB_ROLE = {
    admin: "ADMIN",
    operator: "OPERATOR",
    agent: "AGENT",
    rescue_agent: "AGENT",
    citizen: "CITIZEN",
};

// Map DB Role names to frontend role keys
const DB_TO_FRONTEND_ROLE = {
    ADMIN: "admin",
    OPERATOR: "operator",
    AGENT: "agent",
    CITIZEN: "citizen",
};


// Supported permission actions in Prisma enum
const PERMISSION_ACTIONS = [
    "VIEW_MAP",
    "DISPATCH",
    "BROADCAST",
    "MANAGE_USERS",
    "MANAGE_ORGS",
    "PUBLISH_NEWS",
    "EXPORT_REPORTS",
    "SYSTEM_SETTINGS",
];

// Helper to seed initial permissions into DB if empty
async function seedDefaultPermissionsIfEmpty() {
    const count = await prisma.rolePermission.count();
    if (count > 0) return;

    const roles = await prisma.role.findMany();
    const roleMap = {};
    roles.forEach(r => {
        roleMap[r.name] = r.id;
    });

    for (const [feRole, perms] of Object.entries(DEFAULT_GRID)) {
        const dbRoleName = FRONTEND_TO_DB_ROLE[feRole];
        const roleId = roleMap[dbRoleName];
        if (!roleId) continue;

        for (const [permKey, isGranted] of Object.entries(perms)) {
            const actionUpper = permKey.toUpperCase();
            if (!PERMISSION_ACTIONS.includes(actionUpper)) continue;

            await prisma.rolePermission.upsert({
                where: {
                    roleId_action: {
                        roleId,
                        action: actionUpper,
                    },
                },
                update: { isGranted },
                create: {
                    roleId,
                    action: actionUpper,
                    isGranted,
                },
            });
        }
    }
}

// ==========================
// Get Role Permissions
// ==========================
exports.getRolePermissions = async () => {
    // Seed default permissions if database has none
    await seedDefaultPermissionsIfEmpty().catch(err => {
        console.warn("Permission seed error:", err.message);
    });

    const records = await prisma.rolePermission.findMany({
        include: { role: true },
    });

    const grid = structuredClone(DEFAULT_GRID);

    records.forEach(record => {
        const dbRoleName = record.role?.name?.toUpperCase();
        const feRole = DB_TO_FRONTEND_ROLE[dbRoleName];
        const action = record.action?.toLowerCase();

        if (feRole && grid[feRole] && grid[feRole][action] !== undefined) {
            grid[feRole][action] = record.isGranted;
        }
    });

    return grid;
};

// ==========================
// Update Role Permissions
// ==========================
exports.updateRolePermissions = async (permissions) => {
    if (!permissions || typeof permissions !== "object") {
        return structuredClone(DEFAULT_GRID);
    }

    const roles = await prisma.role.findMany();
    const roleMap = {};
    roles.forEach(r => {
        roleMap[r.name] = r.id;
    });

    for (const feRole of Object.keys(permissions)) {
        const roleKeyLower = feRole.toLowerCase();
        const dbRoleName = FRONTEND_TO_DB_ROLE[roleKeyLower] || roleKeyLower.toUpperCase();
        let roleId = roleMap[dbRoleName];

        if (!roleId) {
            continue;
        }


        const rolePerms = permissions[feRole];
        if (typeof rolePerms !== "object") continue;

        for (const actionKey of Object.keys(rolePerms)) {
            const actionUpper = actionKey.toUpperCase();
            if (!PERMISSION_ACTIONS.includes(actionUpper)) continue;

            const isGranted = Boolean(rolePerms[actionKey]);

            await prisma.rolePermission.upsert({
                where: {
                    roleId_action: {
                        roleId,
                        action: actionUpper,
                    },
                },
                update: {
                    isGranted,
                },
                create: {
                    roleId,
                    action: actionUpper,
                    isGranted,
                },
            });
        }
    }

    return await exports.getRolePermissions();
};

// ==========================
// Reset Role Permissions
// ==========================
exports.resetRolePermissions = async () => {
    await prisma.rolePermission.deleteMany({});
    await seedDefaultPermissionsIfEmpty();
    return await exports.getRolePermissions();
};