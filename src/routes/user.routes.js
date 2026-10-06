const express = require("express");
const router = express.Router();

const userController = require("../controllers/user.controller");

const {
    verifyToken,
    checkRole
} = require("../middleware/auth.middleware");

const {
    validateRequest
} = require("../middleware/validator");

const {
    upload
} = require("../middleware/upload.middleware");

const {
    createUserSchema,
    updateUserSchema,
    blockUserSchema,
} = require("../validators/user.validator");

// ========================
// GET ALL USERS
// ========================
router.get(
    "/",
    verifyToken,
    checkRole(["ADMIN"]),
    userController.getAllUsers
);

// ========================
// GET DELETED USERS  ← ត្រូវដាក់មុន /:id
// ========================
router.get(
    "/deleted",
    verifyToken,
    checkRole(["ADMIN"]),
    userController.getDeletedUsers
);

// ========================
// GET CURRENT USER (profile)
// ========================
router.get(
    "/me",
    verifyToken,
    userController.getMe
);

// ========================
// GET USER BY ID
// ========================
router.get(
    "/:id",
    verifyToken,
    checkRole(["ADMIN"]),
    userController.getUserById
);

// ========================
// CREATE USER
// ========================
router.post(
    "/",
    verifyToken,
    checkRole(["ADMIN"]),
    upload.single("avatar"),          // ✅ បន្ថែម
    validateRequest(createUserSchema),
    userController.createUser
);

// ========================
// UPDATE USER
// ========================
router.put(
    "/:id",
    verifyToken,
    checkRole(["ADMIN"]),
    upload.single("avatar"),          // ✅ បន្ថែម
    validateRequest(updateUserSchema),
    userController.updateUser
);

// ========================
// DELETE USER (soft)
// ========================
router.delete(
    "/:id",
    verifyToken,
    checkRole(["ADMIN"]),
    userController.deleteUser
);

// ========================
// RESTORE USER
// ========================
router.patch(
    "/:id/restore",
    verifyToken,
    checkRole(["ADMIN"]),
    userController.restoreUser
);

// ========================
// BLOCK / UNBLOCK USER
// ========================
router.patch(
    "/:id/block",
    verifyToken,
    checkRole(["ADMIN"]),
    validateRequest(blockUserSchema),   // ✅ បន្ថែម
    userController.blockUser
);

module.exports = router;