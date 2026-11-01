const express = require("express");
const router = express.Router();

const broadcastController = require("../controllers/broadcast.controller");

const {
    verifyToken,
    checkRole,
    optionalAuth
} = require("../middleware/auth.middleware");

const {
    validateRequest
} = require("../middleware/validator");

const {
    createBroadcastSchema,
    updateBroadcastSchema
} = require("../validators/broadcast.validator");


// ==========================
// Get All Broadcasts
// ==========================
// ✅ [Mobile Integration & Security Fix] ប្រើ optionalAuth ដើម្បីអនុញ្ញាតឱ្យសាធារណជនទូទៅអាចមើលឃើញ Broadcast ជាសាធារណៈ (ALL_CITIZENS) ដោយមិនបាច់ Login
// និងភ្ជាប់ req.user ប្រសិនបើមាន Token ដើម្បីឱ្យ Controller/Service អាច Filter តាម Role (ALL_CITIZENS, RESCUE_AGENTS) បានត្រឹមត្រូវ
router.get(
    "/",
    optionalAuth,
    broadcastController.getAllBroadcasts
);


// ==========================
// Get Broadcast Options / Metadata
// ==========================
router.get(
    "/options",
    broadcastController.getBroadcastOptions
);


// ==========================
// Get Broadcast By ID
// ==========================
router.get(
    "/:id",
    verifyToken,
    broadcastController.getBroadcastById
);


// ==========================
// Create Broadcast
// ==========================
router.post(
    "/",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    validateRequest(createBroadcastSchema),
    broadcastController.createBroadcast
);


// ==========================
// Update Broadcast
// ==========================
router.put(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    validateRequest(updateBroadcastSchema),
    broadcastController.updateBroadcast
);


// ==========================
// Update Broadcast Status
// ==========================
router.patch(
    "/:id/status",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    broadcastController.updateBroadcastStatus
);


// ==========================
// Delete Broadcast
// ==========================
router.delete(
    "/:id",
    verifyToken,
    checkRole(["ADMIN", "OPERATOR"]),
    broadcastController.deleteBroadcast
);

module.exports = router;