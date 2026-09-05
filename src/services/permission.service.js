const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_GRID = {

    ADMIN: {

        view_map: true,
        dispatch: true,
        broadcast: true,
        manage_users: true,
        manage_orgs: true,
        export_reports: true,
        system_settings: true

    },

    OPERATOR: {

        view_map: true,
        dispatch: true,
        broadcast: true,
        manage_users: false,
        manage_orgs: false,
        export_reports: true,
        system_settings: false

    },

    AGENT: {

        view_map: true,
        dispatch: true,
        broadcast: false,
        manage_users: false,
        manage_orgs: false,
        export_reports: false,
        system_settings: false

    },

    CITIZEN: {

        view_map: false,
        dispatch: false,
        broadcast: false,
        manage_users: false,
        manage_orgs: false,
        export_reports: false,
        system_settings: false

    }

};

let inMemoryGrid = structuredClone(DEFAULT_GRID);


// ==========================
// Get Role Permissions
// ==========================
exports.getRolePermissions = async () => {

    const records =
        await prisma.rolePermission.findMany();

    if (records.length === 0) {

        return inMemoryGrid;

    }

    const grid =
        structuredClone(DEFAULT_GRID);

    records.forEach(record => {

        const role =
            record.role.toUpperCase();

        const action =
            record.action.toLowerCase();

        if (
            grid[role] &&
            grid[role][action] !== undefined
        ) {

            grid[role][action] =
                record.isGranted;

        }

    });

    return grid;

};


// ==========================
// Update Role Permissions
// ==========================
exports.updateRolePermissions = async (permissions) => {

    if (
        permissions &&
        typeof permissions === "object"
    ) {

        inMemoryGrid = {

            ...inMemoryGrid,

            ...permissions

        };

        for (const role of Object.keys(permissions)) {

            for (const action of Object.keys(permissions[role])) {

                await prisma.rolePermission.upsert({

                    where: {

                        role_action: {

                            role: role.toUpperCase(),

                            action: action.toUpperCase()

                        }

                    },

                    update: {

                        isGranted:
                            Boolean(
                                permissions[role][action]
                            )
                    },

                    create: {

                        role:
                            role.toUpperCase(),

                        action:
                            action.toUpperCase(),

                        isGranted:
                            Boolean(
                                permissions[role][action]
                            )
                    }

                });

            }
        }
    }
    return inMemoryGrid;

};