const express = require("express");
const { upload } = require("../middleware/upload.middleware");
const router = express.Router();

const {
    verifyToken,
    checkRole
} = require("../middleware/auth.middleware");

const {
    validateRequest
} = require("../middleware/validator");

const {
    createSosSchema,
    updateStatusSchema
} = require("../validators/sos.validator");


const {
    listAlerts,
    getAlert,
    createAlert,
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
// GET SOS BY ID
// ===============================
router.get(
    "/:id",
    verifyToken,
    getAlert
);


// ===============================
// CREATE SOS
// Citizen / Operator
// ===============================
router.post(
    "/",
    verifyToken,
    validateRequest(createSosSchema),
    upload.array("media", 5),
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
// ADD MEDIA
// ===============================
router.post(
    "/:id/media",
    verifyToken,
    checkRole([
        "ADMIN",
        "OPERATOR",
        "RESCUE_AGENT"
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