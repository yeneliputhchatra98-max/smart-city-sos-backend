const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");

// Middleware
const { verifyToken } = require("../middleware/auth.middleware");
const { rateLimiter } = require("../middleware/rateLimiter");
const { validateRequest } = require("../middleware/validator");
const { requestLogger: logger } = require("../middleware/logger");
const { upload } = require("../middleware/upload.middleware");

// Validation Schemas
const {
    registerSchema,
    loginSchema,
    refreshSchema,
    changePasswordSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    verifyEmailSchema,
    updateProfileSchema,
    googleLoginSchema,
} = require("../validators/auth.validator");

// ==================== PUBLIC ROUTES ====================

// Register
router.post(
    "/register",
    rateLimiter(5, 60 * 1000),
    validateRequest(registerSchema),
    authController.register
);

// Login
router.post(
    "/login",
    rateLimiter(10, 60 * 1000),
    validateRequest(loginSchema),
    authController.login
);

// Google Login
router.post(
    "/google",
    rateLimiter(10, 60 * 1000),
    validateRequest(googleLoginSchema),
    authController.googleLogin
);

// Refresh Token
router.post(
    "/refresh",
    rateLimiter(20, 60 * 1000),
    validateRequest(refreshSchema),
    authController.refresh
);

// Forgot Password
router.post(
    "/forgot-password",
    rateLimiter(3, 60 * 1000),
    validateRequest(forgotPasswordSchema),
    authController.forgotPassword
);

// Reset Password
router.post(
    "/reset-password",
    rateLimiter(5, 60 * 1000),
    validateRequest(resetPasswordSchema),
    authController.resetPassword
);

// Verify Email
router.get(
    "/verify",
    authController.verifyEmail
);

// Resend Verification Email
router.post(
    "/verify/resend",
    rateLimiter(3, 60 * 1000),
    authController.resendVerification
);

// ==================== PROTECTED ROUTES ====================

// Logout
router.post(
    "/logout",
    verifyToken,
    logger,
    authController.logout
);

// Fork Session (for duplicated tabs to acquire isolated sessions)
router.post(
    "/fork-session",
    verifyToken,
    logger,
    authController.forkSession
);

// Get Profile
router.get(
    "/profile",
    verifyToken,
    logger,
    authController.getProfile
);

// Update Profile (with optional avatar upload)
router.put(
    "/profile",
    verifyToken,
    logger,
    upload.single("avatar"),         // ✅ បន្ថែម
    validateRequest(updateProfileSchema),
    authController.updateProfile
);

// Update Avatar only
router.patch(
    "/profile/avatar",
    verifyToken,
    logger,
    upload.single("avatar"),         // ✅ បន្ថែម
    authController.updateAvatar
);

// Delete Avatar
router.delete(
    "/profile/avatar",
    verifyToken,
    logger,
    authController.deleteAvatar
);

// Change Password
router.post(
    "/change-password",
    verifyToken,
    logger,
    validateRequest(changePasswordSchema),
    authController.changePassword
);

module.exports = router;