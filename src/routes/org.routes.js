const express = require("express");
const router = express.Router();

const organizationController = require("../controllers/org.controller");

const {
    verifyToken,
    checkRole
} = require("../middleware/auth.middleware");

const {
    validateRequest
} = require("../middleware/validator");

const {
    createOrganizationSchema,
    updateOrganizationSchema
} = require("../validators/org.validator");

// ==========================
// Get All Organizations
// ==========================
router.get(
    "/",
    verifyToken,
    checkRole(["ADMIN", "ORG_MANAGER"]),
    organizationController.getAllOrgs
);

// ==========================
// Create Organization
// ==========================
router.post(
    "/",
    verifyToken,
    checkRole(["ADMIN"]),
    validateRequest(createOrganizationSchema),
    organizationController.createOrg
);

// ==========================
// Update Organization
// ==========================
router.put(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "ORG_MANAGER"]),
    validateRequest(updateOrganizationSchema),
    organizationController.updateOrg
);

// ==========================
// Delete Organization
// ==========================
router.delete(
    "/:id",
    verifyToken,
    checkRole(["ADMIN"]),
    organizationController.deleteOrg
);

router.get(
    "/:id",
    verifyToken,
    checkRole(["ADMIN"]),
    organizationController.getOrgById
);

router.patch(
    "/:id/status",
    verifyToken,
    checkRole(["ADMIN"]),
    organizationController.updateStatus
);

module.exports = router;