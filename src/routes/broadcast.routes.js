const express = require("express");
const router = express.Router();

const broadcastController = require("../controllers/broadcast.controller");

const {
    verifyToken,
    checkRole
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
router.get(
    "/",
    verifyToken,
    broadcastController.getAllBroadcasts
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
    checkRole(["ADMIN"]),
    broadcastController.deleteBroadcast
);

module.exports = router;