const express = require("express");
const { upload } = require("../middleware/upload.middleware");
const router = express.Router();

const {
    verifyToken,
    checkRole,
    optionalAuth
} = require("../middleware/auth.middleware");

const {
    validateRequest
} = require("../middleware/validator");

const { checkMaintenanceMode } = require("../middleware/maintenance.middleware");

const {
    createSosSchema,
    updateStatusSchema,
    dispatchAgentSchema,
} = require("../validators/sos.validator");

const {
    listAlerts,
    listAssignedAlerts,
    getAlert,
    getAlertTimeline,
    createAlert,
    dispatchAgent,
    declineMission,
    acknowledgeMission,
    triggerAutoDispatch,
    getCandidateAgents,
    updateStatus,
    addMedia,
    deleteAlert,
} = require("../controllers/sos.controller");
// ===============================
// GET ALL SOS ALERTS
// ===============================
router.get(
    "/",
    verifyToken,
    checkRole([
        "ADMIN",
        "OPERATOR",
        "AGENT",
        "CITIZEN"
    ]),
    listAlerts
);

// ===============================
// GET ASSIGNED ALERTS FOR RESPONDER
// ===============================
router.get(
    "/assigned",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT"]),
    listAssignedAlerts
);

// ===============================
// GET SOS BY ID
// ===============================
router.get(
    "/:id",
    verifyToken,
    getAlert
);

// ===============================
// GET SOS AUDIT TIMELINE & LIFECYCLE
// Traceability: Who, When, Why
// ===============================
router.get(
    "/:id/timeline",
    verifyToken,
    checkRole([
        "ADMIN",
        "OPERATOR",
        "AGENT",
        "CITIZEN"
    ]),
    getAlertTimeline
);

// ===============================
// CREATE SOS
// Citizen / Operator
// ===============================
router.post(
    "/",
    optionalAuth,
    checkMaintenanceMode,
    upload.array("media", 5),
    validateRequest(createSosSchema),
    createAlert
);

// Public SOS route alias
router.post(
    "/public",
    optionalAuth,
    checkMaintenanceMode,
    upload.array("media", 5),
    validateRequest(createSosSchema),
    createAlert
);

// ===============================
// UPDATE STATUS
// Assign Agent / Resolve
// ===============================
router.patch(
    "/:id",
    verifyToken,
    checkRole([
        "ADMIN",
        "OPERATOR",
        "AGENT",
        "CITIZEN"
    ]),
    validateRequest(updateStatusSchema),
    updateStatus
);

// ===============================
// DISPATCH AGENT
// Admin / Operator
// ===============================
router.post(
    "/:id/dispatch",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    validateRequest(dispatchAgentSchema),
    dispatchAgent
);

// ===============================
// DECLINE MISSION (Fallback)
// Agent / Operator / Admin
// ===============================
router.post(
    "/:id/decline",
    verifyToken,
    checkRole(["AGENT", "ADMIN", "OPERATOR"]),
    declineMission
);

// ===============================
// ACKNOWLEDGE MISSION (Agent Accept)
// Agent / Operator / Admin
// ===============================
router.post(
    "/:id/acknowledge",
    verifyToken,
    checkRole(["AGENT", "ADMIN", "OPERATOR"]),
    acknowledgeMission
);

// ===============================
// AUTO-DISPATCH TRIGGER
// Operator / Admin
// ===============================
router.post(
    "/:id/auto-dispatch",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    triggerAutoDispatch
);

// ===============================
// GET RANKED CANDIDATE AGENTS
// Operator / Admin
// ===============================
router.get(
    "/:id/candidates",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    getCandidateAgents
);


// ===============================
// ADD MEDIA
// ===============================
router.post(
    "/:id/media",
    verifyToken,
    checkRole([
        "ADMIN",
        "OPERATOR",
        "AGENT"
    ]),
    upload.array("media", 10),
    addMedia
);

// ===============================
// DELETE SOS
// ===============================
router.delete(
    "/:id",
    verifyToken,
    checkRole([
        "ADMIN",
        "OPERATOR"
    ]),
    deleteAlert
);

module.exports = router;
