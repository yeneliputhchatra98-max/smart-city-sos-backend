const express = require("express");
const router = express.Router();

const auditController = require("../controllers/audit.controller");
const {
    verifyToken,
    checkRole
} = require("../middleware/auth.middleware");

// ─── Get Audit Logs ──────────────────────────────────────────────────────────
router.get(
    "/",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT", "ORG_MANAGER"]),
    auditController.getAuditLogs
);

// ✅ បន្ថែម POST Route
router.post(
    "/",
    verifyToken,
    auditController.createAuditLog
);

// ─── Auto Cleanup Schedule & Trigger ─────────────────────────────────────────
router.get(
    "/cleanup-status",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    auditController.getCleanupStatus
);

router.post(
    "/cleanup",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    auditController.cleanupOldLogs
);

module.exports = router;