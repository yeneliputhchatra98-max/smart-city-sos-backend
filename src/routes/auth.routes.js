const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");

// Middleware
const { authMiddleware, roleMiddleware } = require("../utils/jwt");
const { verifyToken } = require("../middleware/auth.middleware");
const { rateLimiter } = require("../middleware/rateLimiter");
const { validateRequest } = require("../middleware/validator");
const { requestLogger: logger } = require("../middleware/logger");

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
    appleLoginSchema
} = require("../validators/auth.validator");


// ==================== PUBLIC ROUTES ====================

router.post(
    "/google",
    rateLimiter(10, 60 * 1000),
    validateRequest(googleLoginSchema),
    authController.googleLogin
);

router.post(
    "/apple",
    rateLimiter(10, 60 * 1000),
    validateRequest(appleLoginSchema),
    authController.appleLogin
);

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

router.use(authMiddleware);

router.use(logger);


// Logout
router.post(
    "/logout",
    verifyToken,
    authController.logout
);


// Get Profile
router.get(
    "/profile",
    authController.getProfile
);


// Update Profile
router.put(
    "/profile",
    validateRequest(updateProfileSchema),
    authController.updateProfile
);


// Change Password
router.post(
    "/change-password",
    validateRequest(changePasswordSchema),
    authController.changePassword
);



module.exports = router;