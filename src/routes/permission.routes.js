const express = require("express");
const router = express.Router();

const permissionController = require("../controllers/permission.controller");

const {
    verifyToken,
    checkRole
} = require("../middleware/auth.middleware");

const {
    validateRequest
} = require("../middleware/validator");

const {
    updatePermissionSchema
} = require("../validators/permission.validator");

// ==========================
// Get all role permissions
// ==========================
router.get(
    "/",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT", "CITIZEN"]),
    permissionController.getRolePermissions
);

// ==========================
// Update role permissions
// ==========================
router.put(
    "/",
    verifyToken,
    checkRole(["ADMIN"]),
    validateRequest(updatePermissionSchema),
    permissionController.updateRolePermissions
);

// ==========================
// Reset role permissions to defaults
// ==========================
router.post(
    "/reset",
    verifyToken,
    checkRole(["ADMIN"]),
    permissionController.resetRolePermissions
);

module.exports = router;