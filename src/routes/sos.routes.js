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
    getMyAlerts,
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
// ✅ [P0 Security Fix] កម្រិតសិទ្ធិ GET / ឱ្យចូលមើលបានតែ ADMIN និង OPERATOR ប៉ុណ្ណោះ (Citizens ត្រូវប្រើ /my)
router.get(
    "/",
    verifyToken,
    checkRole([
        "ADMIN",
        "OPERATOR"
    ]),
    listAlerts
);

// =====================================
// ✅ [Mobile Integration Fix] GET CITIZEN OWN SOS ALERTS
// ផ្ដល់ទិន្នន័យ SOS ផ្ទាល់ខ្លួនរបស់ពលរដ្ឋសម្រាប់ Mobile App (ដាក់ពីមុខ /:id ដើម្បីកុំឱ្យជាន់ Route)
// =====================================
router.get(
    "/my",
    verifyToken,
    getMyAlerts
);
// ===============================
// GET ASSIGNED ALERTS FOR RESPONDER
// ===============================
// ✅ [P0 Security Fix] អនុញ្ញាតឱ្យ AGENT និង RESPONDER ទាញយកបេសកកម្មដែលបានចាត់តាំង
router.get(
    "/assigned",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR", "AGENT", "RESPONDER"]),
    listAssignedAlerts
);

// ===============================
// GET SOS BY ID
// ===============================
// ✅ [P0 Security Fix] ផ្ទៀងផ្ទាត់ Token និងពិនិត្យសិទ្ធិចូលមើល (IDOR Protection) នៅកម្រិត Service
// (Citizen មើលបានតែ Alert ផ្ទាល់ខ្លួន, Responder មើលបានតែ Alert ដែលចាត់តាំងឱ្យខ្លួន, Staff មើលបានទាំងអស់)
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
// ✅ [P0 Security Fix] លុប CITIZEN ចេញពី PATCH /:id ដើម្បីកុំឱ្យពលរដ្ឋកែប្រែស្ថានភាព ឬចាត់តាំង Agent បាន
router.patch(
    "/:id",
    verifyToken,
    checkRole([
        "ADMIN",
        "OPERATOR",
        "AGENT",
        "RESPONDER"
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
// ✅ [P0 Security Fix] បន្ថែម Role RESPONDER ឱ្យអាចបដិសេធបេសកកម្មដែលបានចាត់តាំងឱ្យខ្លួនបាន
router.post(
    "/:id/decline",
    verifyToken,
    checkRole(["AGENT", "RESPONDER", "ADMIN", "OPERATOR"]),
    declineMission
);

// ===============================
// ACKNOWLEDGE MISSION (Agent Accept)
// Agent / Operator / Admin
// ===============================
// ✅ [P0 Security Fix] បន្ថែម Role RESPONDER ឱ្យអាចទទួលយកបេសកកម្មដែលបានចាត់តាំងឱ្យខ្លួនបាន
router.post(
    "/:id/acknowledge",
    verifyToken,
    checkRole(["AGENT", "RESPONDER", "ADMIN", "OPERATOR"]),
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
