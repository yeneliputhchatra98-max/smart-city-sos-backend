const permissionService = require("../services/permission.service");

// ==========================
// Get Role Permissions
// ==========================
exports.getRolePermissions = async (req, res, next) => {

    try {

        const permissions =
            await permissionService.getRolePermissions();

        return res.status(200).json({

            success: true,
            data: permissions

        });

    } catch (err) {

        next(err);

    }

};


// ==========================
// Update Role Permissions
// ==========================
exports.updateRolePermissions = async (req, res, next) => {

    try {

        const permissions =
            await permissionService.updateRolePermissions(
                req.body.permissions
            );

        return res.status(200).json({

            success: true,

            message: "Permissions updated successfully",

            data: permissions

        });

    } catch (err) {

        next(err);

    }

};