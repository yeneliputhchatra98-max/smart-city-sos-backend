const authService = require("../services/auth.service");
const logger = require("../utils/logger");
const { validateEmail, validatePassword, validatePhone } = require("../utils/validators");
const { AppError } = require("../middleware/errorHandler");

// ==================== AUTHENTICATION CONTROLLERS ====================

// Register
// =====================================================
// REGISTER
// =====================================================

const register = async (req, res, next) => {
    const startTime = Date.now();

    try {
        // =============================
        // 1. Check request body
        // =============================
        if (
            !req.body ||
            typeof req.body !== "object" ||
            Object.keys(req.body).length === 0
        ) {
            throw new AppError(
                "Request body is required",
                400,
                "EMPTY_BODY"
            );
        }

        // =============================
        // 2. Get data
        // =============================
        const {
            fullName,
            username,
            email,
            password,
            phone,
            role
        } = req.body;

        // =============================
        // 3. Required fields
        // =============================
        const requiredFields = {
            fullName,
            username,
            email,
            password,
            phone
        };

        const missingFields = Object.entries(
            requiredFields
        )
            .filter(
                ([_, value]) =>
                    !value ||
                    typeof value !== "string" ||
                    value.trim() === ""
            )
            .map(([key]) => key);

        if (missingFields.length > 0) {
            throw new AppError(
                `Missing required fields: ${missingFields.join(", ")}`,
                400,
                "MISSING_FIELDS"
            );
        }

        // =============================
        // 4. Validate email
        // =============================
        if (!validateEmail(email)) {
            throw new AppError(
                "Invalid email format",
                400,
                "INVALID_EMAIL"
            );
        }

        // =============================
        // 5. Validate password
        // =============================
        if (!validatePassword(password)) {
            throw new AppError(
                "Password must be at least 8 characters with uppercase, lowercase and number",
                400,
                "WEAK_PASSWORD"
            );
        }

        // =============================
        // 6. Validate phone
        // =============================
        if (!validatePhone(phone)) {
            throw new AppError(
                "Invalid phone number format",
                400,
                "INVALID_PHONE"
            );
        }

        // =============================
        // 7. Validate username
        // =============================
        if (username.includes(" ")) {
            throw new AppError(
                "Username cannot contain spaces",
                400,
                "INVALID_USERNAME"
            );
        }

        // =============================
        // 8. Call service
        // =============================
        const result = await authService.register({
            fullName,
            username,
            email,
            password,
            phone,
            role: role || "CITIZEN"
        });

        // =============================
        // 9. Logging
        // =============================
        const responseTime =
            Date.now() - startTime;

        logger.info(
            `User registered successfully: ${email} - ${responseTime}ms`,
            {
                userId: result.userId,
                email: result.email,
                role: result.role,
                ip: req.ip,
                userAgent: req.get("User-Agent")
            }
        );

        // =============================
        // 10. Response
        // =============================
        return res.status(201).json({
            success: true,

            message:
                "Registration successful! Please verify your email.",

            data: {
                userId: result.userId,
                email: result.email,
                fullName: result.fullName,
                role: result.role,
                requiresVerification:
                    result.requiresVerification
            },

            timestamp:
                new Date().toISOString()
        });

    } catch (error) {
        next(error);
    }
};


// Login
const login = async (req, res, next) => {
    const startTime = Date.now();

    const clientIP =
        req.ip || req.connection.remoteAddress;

    const userAgent =
        req.headers["user-agent"];

    try {
        const { email, password } = req.body;

        // =============================
        // Validation
        // =============================

        if (!email || !password) {
            throw new AppError(
                "Email and password are required",
                400,
                "MISSING_CREDENTIALS"
            );
        }

        if (!validateEmail(email)) {
            throw new AppError(
                "Invalid email format",
                400,
                "INVALID_EMAIL"
            );
        }

        // =============================
        // Login Service
        // =============================

        const result = await authService.login(
            email.toLowerCase().trim(),
            password,
            clientIP
        );

        const responseTime =
            Date.now() - startTime;

        logger.info(
            `User logged in: ${email} (${responseTime}ms)`
        );

        if (userAgent) {
            logger.debug(
                `User Agent: ${userAgent}`
            );
        }

        return res.status(200).json({
            success: true,
            message: "Login successful",

            data: {
                user: result.user,
                token: result.token,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn
            },

            timestamp: new Date().toISOString()
        });

    } catch (error) {

    console.log("CONTROLLER ERROR:");
    console.log("message:", error.message);
    console.log("code:", error.code);
    console.log("status:", error.statusCode);

    if (error.code === "EMAIL_NOT_VERIFIED") {
        return next(error);
    }

    return next(
        new AppError(
            "Invalid email or password",
            401,
            "INVALID_CREDENTIALS"
        )
    );
}
};

module.exports = {
    login
};
// Refresh Token
const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new AppError(
                "Refresh token required",
                400,
                "MISSING_REFRESH_TOKEN"
            );
        }

        const result =
            await authService.refreshAccessToken(refreshToken);

        logger.info(
            `Token refreshed for user from IP ${req.ip}`
        );

        return res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            data: {
    token: result.token,
    refreshToken: result.refreshToken,
    expiresIn: result.expiresIn || "24h",
},
            timestamp: new Date().toISOString(),
        });

    } catch (error) {
        logger.error(
            `Refresh token error: ${error.message}`
        );

        return next(
            error instanceof AppError
                ? error
                : new AppError(
                    "Invalid refresh token",
                    401,
                    "INVALID_REFRESH_TOKEN"
                )
        );
    }
};
// Logout
const logout = async (req, res, next) => {
    try {

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Token required",
                code: "NO_TOKEN"
            });
        }

        const token = authHeader.split(" ")[1];

        const result = await authService.logout(token);

        return res.status(200).json({
            success: true,
            message: "Logout successful",
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        next(error);
    }
};
// ==================== USER PROFILE CONTROLLERS ====================

// Get Current User Profile
const getProfile = async (req, res, next) => {
    try {

        const userId = req.user.id;

        const user = await authService.getUserProfile(userId);

        res.status(200).json({
            success: true,
            data: user,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        next(
            new AppError(
                error.message || "User not found",
                404,
                "PROFILE_NOT_FOUND"
            )
        );
    }
};


// Update Profile
const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const {
            fullName,
            email,
            phone
        } = req.body;

        // Avatar from upload file
        const avatar = req.file
            ? req.file.filename
            : undefined;

        // Check fields
        if (
            !fullName &&
            !email &&
            !phone &&
            !avatar
        ) {
            throw new AppError(
                "At least one field to update is required",
                400,
                "NO_FIELDS_TO_UPDATE"
            );
        }

        // Validate email
        if (email && !validateEmail(email)) {
            throw new AppError(
                "Invalid email format",
                400,
                "INVALID_EMAIL"
            );
        }

        // Validate phone
        if (phone && phone.length < 8) {
            throw new AppError(
                "Invalid phone number",
                400,
                "INVALID_PHONE"
            );
        }

        const result = await authService.updateProfile(
            userId,
            {
                fullName,
                email,
                phone,
                avatar
            }
        );

        logger.info(
            `Profile updated for user: ${req.user.email}`
        );

        return res.status(200).json({

            success: true,

            message: "Profile updated successfully",

            data: result,

            timestamp: new Date().toISOString()

        });

    } catch (error) {

        next(
            new AppError(
                error.message || "Unable to update profile",
                400,
                "UPDATE_PROFILE_FAILED"
            )
        );

    }
};
// Change Password (Protected)
const changePassword = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { oldPassword, newPassword } = req.body;

        if (!oldPassword || !newPassword) {
            throw new AppError("Old password and new password required", 400, "MISSING_PASSWORD");
        }

        if (!validatePassword(newPassword)) {
            throw new AppError(
                "Password must be at least 8 characters with uppercase, lowercase, and number",
                400,
                "WEAK_PASSWORD"
            );
        }

        await authService.changePassword(userId, oldPassword, newPassword);

        logger.info(`Password changed for user: ${req.user.email}`);

        res.status(200).json({
            success: true,
            message: "Password updated successfully",
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        next(new AppError(error.message || "Password change failed", 400, "PASSWORD_CHANGE_FAILED"));
    }
};

// ==================== PASSWORD RESET CONTROLLERS ====================

// Forgot Password (Request Reset)
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        // Validate email
        if (!email || !validateEmail(email)) {
            throw new AppError(
                "Valid email required",
                400,
                "INVALID_EMAIL"
            );
        }

        // Request password reset
        await authService.forgotPassword(email);

        logger.info(
            `Password reset requested for: ${email}`
        );

        // Always return success
        // Don't reveal whether email exists
        return res.status(200).json({
            success: true,
            message:
                "If the email exists, a reset link will be sent",
            timestamp: new Date().toISOString(),
        });

    } catch (error) {

        logger.error(
            `Forgot password controller error: ${error.message}`
        );

        // Don't reveal whether email exists
        return res.status(200).json({
            success: true,
            message:
                "If the email exists, a reset link will be sent",
            timestamp: new Date().toISOString(),
        });
    }
};


// Reset Password (With Token)
const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        // Validate input
        if (!token || !newPassword) {
            throw new AppError(
                "Token and new password required",
                400,
                "MISSING_FIELDS"
            );
        }

        // Validate password
        if (!validatePassword(newPassword)) {
            throw new AppError(
                "Password must be at least 8 characters with uppercase, lowercase and number",
                400,
                "WEAK_PASSWORD"
            );
        }

        // Reset password
        await authService.resetPassword(
            token,
            newPassword
        );

        logger.info(
            "Password reset successful"
        );

        return res.status(200).json({
            success: true,
            message: "Password reset successful",
            timestamp: new Date().toISOString(),
        });

    } catch (error) {

        logger.error(
            `Reset password controller error: ${error.message}`
        );

        return next(
            new AppError(
                error.message || "Password reset failed",
                400,
                "RESET_FAILED"
            )
        );
    }
};
// ==================== EMAIL VERIFICATION CONTROLLERS ====================

// Verify Email
// User click verification link from email
const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.query;

        console.log("TOKEN FROM REQUEST:");
        console.log(token);

        if (!token) {
            throw new AppError(
                "Verification token is required",
                400,
                "TOKEN_REQUIRED"
            );
        }

        const result =
            await authService.verifyEmail(token);

        return res.status(200).json({
            success: true,
            message: result.alreadyVerified
                ? "Email is already verified."
                : "Email verified successfully!",
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        next(error);
    }
};


// Resend Verification Email
// Send verification email again when user did not receive email
const resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email || !validateEmail(email)) {
            throw new AppError(
                "Valid email required",
                400,
                "INVALID_EMAIL"
            );
        }

        const result = await authService.resendVerification(email);

        logger.info(
            `Verification email resent to: ${email}`
        );

        return res.status(200).json({
            success: true,
            message: "Verification email sent successfully",
            data: {
                email: result.email
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error(
            `Resend verification error: ${error.message}`
        );

        next(error);
    }
};
const googleLogin = async (req, res, next) => {
    try {
        const { idToken } = req.body || {};

        if (!idToken) {
            throw new AppError(
                "Google ID token is required",
                400,
                "MISSING_GOOGLE_TOKEN"
            );
        }

        const result = await authService.googleLogin(idToken);

        return res.status(200).json({
            success: true,
            message: "Google login successful",
            data: {
                user: result.user,
                token: result.token,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        next(
            new AppError(
                error.message || "Google authentication failed",
                401,
                "GOOGLE_AUTH_FAILED"
            )
        );
    }
};
// ==================== APPLE LOGIN ====================

const appleLogin = async (req, res, next) => {
    try {

        const {
            identityToken,
            authorizationCode
        } = req.body;

        if (!identityToken) {
            throw new AppError(
                "Apple identity token is required",
                400,
                "MISSING_APPLE_TOKEN"
            );
        }

        const result =
            await authService.appleLogin(
                identityToken,
                authorizationCode
            );

        return res.status(200).json({

            success: true,

            message: "Apple login successful",

            data: {
                user: result.user,
                token: result.token,
                refreshToken: result.refreshToken,
                expiresIn: result.expiresIn
            },

            timestamp: new Date().toISOString()
        });

    } catch (error) {

        logger.error(
            `Apple login controller error: ${error.message}`
        );

        next(
            new AppError(
                error.message ||
                "Apple authentication failed",
                401,
                "APPLE_AUTH_FAILED"
            )
        );
    }
};
// ==================== EXPORT CONTROLLERS ====================

module.exports = {
    // Authentication
    register,
    login,
    googleLogin,
    appleLogin,
    refresh,
    logout,

    // User Profile
    getProfile,
    updateProfile,
    changePassword,

    // Password Reset
    forgotPassword,
    resetPassword,

    // Email Verification
    verifyEmail,
    resendVerification,


};