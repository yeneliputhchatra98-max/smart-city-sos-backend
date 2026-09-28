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
    checkRole(["ADMIN", "OPERATOR"]),
    auditController.getAuditLogs
);

// ✅ បន្ថែម POST Route
router.post(
    "/",
    verifyToken,
    auditController.createAuditLog
);

module.exports = router;