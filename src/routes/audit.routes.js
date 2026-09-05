const express = require("express");
const router = express.Router();

const auditController = require("../controllers/audit.controller");
const {
    verifyToken,
    checkRole
} = require("../middleware/auth.middleware");

// Get Audit Logs
router.get(
    "/",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    auditController.getAuditLogs
);

module.exports = router;
