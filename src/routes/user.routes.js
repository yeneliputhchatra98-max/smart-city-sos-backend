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
    createUserSchema,
    updateUserSchema
} = require("../validators/user.validator");

// GET USERS
router.get(
    "/",
    verifyToken,
    checkRole(["ADMIN"]),
    userController.getAllUsers
);

// GET USER BY ID
router.get(
    "/:id",
    verifyToken,
    checkRole(["ADMIN"]),
    userController.getUserById
);

// CREATE USER
router.post(
    "/",
    verifyToken,
    checkRole(["ADMIN"]),
    validateRequest(createUserSchema),
    userController.createUser
);

// UPDATE USER
router.put(
    "/:id",
    verifyToken,
    checkRole(["ADMIN"]),
    validateRequest(updateUserSchema),
    userController.updateUser
);

// DELETE USER
router.delete(
    "/:id",
    verifyToken,
    checkRole(["ADMIN"]),
    userController.deleteUser
);

// BLOCK / UNBLOCK USER
router.patch(
    "/:id/block",
    verifyToken,
    checkRole(["ADMIN"]),
    userController.blockUser
);

module.exports = router;