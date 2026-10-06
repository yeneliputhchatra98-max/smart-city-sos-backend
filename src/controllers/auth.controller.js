const authService = require("../services/auth.service");
const logger = require("../utils/logger");
const { validateEmail, validatePassword, validatePhone } = require("../utils/validators");
const { AppError } = require("../middleware/errorHandler");

// ==================== HELPERS ====================

const sendSuccess = (res, data = {}, message = null, status = 200) => {
    const payload = {
        success: true,
        ...(message && { message }),
        ...(Object.keys(data).length > 0 && { data }),
        timestamp: new Date().toISOString(),
    };
    return res.status(status).json(payload);
};

/**
 * បម្លែង error ទៅ AppError ជាមួយ status ត្រឹមត្រូវ
 * រក្សា message ដើម បើជា soft delete / blocked
 */
const toAppError = (error, fallback = {}) => {
    if (error instanceof AppError) return error;

    // ✅ ពិនិត្យ code ជាមុន
    if (error.code === "EMAIL_NOT_VERIFIED") {
        return new AppError(error.message, 403, "EMAIL_NOT_VERIFIED");
    }
    if (error.code === "EMAIL_ALREADY_VERIFIED") {
        return new AppError(error.message, 400, "EMAIL_ALREADY_VERIFIED");
    }
    if (error.code === "ACCOUNT_DELETED") {
        return new AppError(error.message, 403, "ACCOUNT_DELETED");
    }
    if (error.code === "ACCOUNT_BLOCKED") {
        return new AppError(error.message, 403, "ACCOUNT_BLOCKED");
    }

    // ✅ រក្សា message ពិតប្រាកដសម្រាប់ soft delete / status
    if (/deleted|blocked|inactive|not active/i.test(error.message)) {
        return new AppError(error.message, 403, "ACCOUNT_INACTIVE");
    }
    if (/not found/i.test(error.message)) {
        return new AppError(error.message, 404, "NOT_FOUND");
    }
    if (/already (registered|exists|verified)/i.test(error.message)) {
        return new AppError(error.message, 409, "DUPLICATE");
    }
    if (/invalid|required|missing|weak|must/i.test(error.message)) {
        return new AppError(error.message, 400, "BAD_REQUEST");
    }
    if (/expired/i.test(error.message)) {
        return new AppError(error.message, 410, "EXPIRED");
    }
    if (/credentials/i.test(error.message)) {
        return new AppError(error.message, 401, "INVALID_CREDENTIALS");
    }

    return new AppError(
        error.message || fallback.message || "Internal Server Error",
        fallback.status || 500,
        fallback.code || "INTERNAL_ERROR"
    );
};

// ==================== REGISTER ====================

const register = async (req, res, next) => {
    const startTime = Date.now();

    try {
        if (!req.body || Object.keys(req.body).length === 0) {
            throw new AppError("Request body is required", 400, "EMPTY_BODY");
        }

        const { fullName, username, email, password, phone, role, birthday, gender } = req.body;

        // Required fields
        const required = { fullName, username, email, password, phone };
        const missing = Object.entries(required)
            .filter(([_, v]) => !v || typeof v !== "string" || v.trim() === "")
            .map(([k]) => k);

        if (missing.length > 0) {
            throw new AppError(
                `Missing required fields: ${missing.join(", ")}`,
                400,
                "MISSING_FIELDS"
            );
        }

        // Validate
        if (!validateEmail(email)) {
            throw new AppError("Invalid email format", 400, "INVALID_EMAIL");
        }
        if (!validatePassword(password)) {
            throw new AppError(
                "Password must be at least 8 characters with uppercase, lowercase and number",
                400,
                "WEAK_PASSWORD"
            );
        }
        if (!validatePhone(phone)) {
            throw new AppError("Invalid phone number format", 400, "INVALID_PHONE");
        }
        if (username.includes(" ")) {
            throw new AppError("Username cannot contain spaces", 400, "INVALID_USERNAME");
        }

        // ✅ Validate birthday
        let birthdayDate = null;
        if (birthday) {
            birthdayDate = new Date(birthday);
            if (isNaN(birthdayDate.getTime())) {
                throw new AppError("Invalid birthday format", 400, "INVALID_BIRTHDAY");
            }
            if (birthdayDate > new Date()) {
                throw new AppError("Birthday cannot be in the future", 400, "INVALID_BIRTHDAY");
            }
        }

        // ✅ Validate gender
        const VALID_GENDERS = ["MALE", "FEMALE", "OTHER"];
        let genderValue = null;
        if (gender) {
            const g = String(gender).trim().toUpperCase();
            if (!VALID_GENDERS.includes(g)) {
                throw new AppError(
                    `Gender must be one of: ${VALID_GENDERS.join(", ")}`,
                    400,
                    "INVALID_GENDER"
                );
            }
            genderValue = g;
        }

        const result = await authService.register({
            fullName,
            username,
            email,
            password,
            phone,
            role: role || "CITIZEN",
            birthday: birthdayDate,
            gender: genderValue,
        });

        const responseTime = Date.now() - startTime;
        logger.info(`User registered: ${email} (${responseTime}ms)`, {
            userId: result.userId,
            ip: req.ip,
        });

        return sendSuccess(
            res,
            {
                userId: result.userId,
                email: result.email,
                fullName: result.fullName,
                role: result.role,
                birthday: result.birthday,
                gender: result.gender,
                requiresVerification: result.requiresVerification,
            },
            "Registration successful! Please verify your email.",
            201
        );
    } catch (error) {
        logger.error(`Register error: ${error.message}`);
        next(toAppError(error));
    }
};

// ==================== LOGIN ====================

const login = async (req, res, next) => {
    const startTime = Date.now();

    try {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new AppError("Email and password are required", 400, "MISSING_CREDENTIALS");
        }

        if (!validateEmail(email)) {
            throw new AppError("Invalid email format", 400, "INVALID_EMAIL");
        }

        const clientIP = req.ip || req.connection?.remoteAddress;
        const userAgent = req.headers["user-agent"] || null;
        const tabId = req.headers["x-tab-id"] || req.body?.tabId || null;

        const result = await authService.login(email.toLowerCase().trim(), password, clientIP, userAgent, tabId);

        const responseTime = Date.now() - startTime;
        logger.info(`User logged in: ${email} (${responseTime}ms) [tab: ${tabId || "none"}]`);

        return sendSuccess(
            res,
            {
                user: result.user,
                token: result.token,
                refreshToken: result.refreshToken,
                sessionId: result.sessionId,
                tabId: result.tabId,
                expiresIn: result.expiresIn,
            },
            "Login successful"
        );
    } catch (error) {
        logger.error(`Login error: ${error.message}`);
        next(toAppError(error));
    }
};

// ==================== REFRESH ====================

const refresh = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            throw new AppError("Refresh token required", 400, "MISSING_REFRESH_TOKEN");
        }

        const tabId = req.headers["x-tab-id"] || req.body?.tabId || null;
        const result = await authService.refreshAccessToken(refreshToken, tabId);

        logger.info(`Token refreshed from IP ${req.ip} [tab: ${tabId || "none"}]`);

        return sendSuccess(
            res,
            {
                token: result.token,
                refreshToken: result.refreshToken,
                sessionId: result.sessionId,
                tabId: result.tabId,
                expiresIn: result.expiresIn || "24h",
            },
            "Token refreshed successfully"
        );
    } catch (error) {
        logger.error(`Refresh token error: ${error.message}`);
        next(toAppError(error, { status: 401, code: "INVALID_REFRESH_TOKEN" }));
    }
};

// ==================== LOGOUT ====================

const logout = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new AppError("Token required", 401, "NO_TOKEN");
        }

        const token = authHeader.split(" ")[1];
        const refreshToken = req.body?.refreshToken || null;
        const tabId = req.headers["x-tab-id"] || req.body?.tabId || null;

        const result = await authService.logout(token, refreshToken, tabId);

        return sendSuccess(res, result, "Logout successful");
    } catch (error) {
        next(toAppError(error));
    }
};

// ==================== FORK SESSION (DUPLICATE TAB) ====================

const forkSession = async (req, res, next) => {
    try {
        const tabId = req.headers["x-tab-id"] || req.body?.tabId || null;
        const result = await authService.forkSession(
            req.user,
            tabId,
            req.ip,
            req.headers["user-agent"]
        );

        return sendSuccess(
            res,
            {
                user: result.user,
                token: result.token,
                refreshToken: result.refreshToken,
                sessionId: result.sessionId,
                tabId: result.tabId,
                expiresIn: result.expiresIn,
            },
            "Session forked successfully"
        );
    } catch (error) {
        logger.error(`Fork session controller error: ${error.message}`);
        next(toAppError(error));
    }
};

// ==================== PROFILE ====================

const getProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await authService.getUserProfile(userId);
        return sendSuccess(res, user);
    } catch (error) {
        logger.error(`Get profile error: ${error.message}`);
        next(toAppError(error, { status: 404, code: "PROFILE_NOT_FOUND" }));
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { fullName, email, phone, birthday, gender } = req.body;   // ✅ បន្ថែម

        // ✅ file object
        const file = req.file || undefined;

        if (!fullName && !email && !phone && !birthday && !gender && !file) {
            throw new AppError(
                "At least one field to update is required",
                400,
                "NO_FIELDS_TO_UPDATE"
            );
        }

        if (email && !validateEmail(email)) {
            throw new AppError("Invalid email format", 400, "INVALID_EMAIL");
        }

        if (phone && phone.length < 8) {
            throw new AppError("Invalid phone number", 400, "INVALID_PHONE");
        }

        const result = await authService.updateProfile(userId, {
            fullName,
            email,
            phone,
            birthday,       // ✅
            gender,         // ✅
            file,           // ✅
        });

        logger.info(`Profile updated for user: ${req.user.email}`);

        return sendSuccess(res, result, "Profile updated successfully");
    } catch (error) {
        logger.error(`Update profile error: ${error.message}`);
        next(toAppError(error, { status: 400, code: "UPDATE_PROFILE_FAILED" }));
    }
};

// ==================== AVATAR ====================

const updateAvatar = async (req, res, next) => {
    try {
        if (!req.file) {
            throw new AppError("Avatar file is required", 400, "NO_FILE");
        }

        const userId = req.user.id;
        const user = await authService.updateAvatar(userId, req.file);

        logger.info(`Avatar updated for: ${req.user.email}`);

        return sendSuccess(
            res,
            {
                avatar: user.avatar,
                url: `/${user.avatar}`,
            },
            "Avatar updated successfully"
        );
    } catch (error) {
        logger.error(`Update avatar error: ${error.message}`);
        next(toAppError(error, { status: 400, code: "UPDATE_AVATAR_FAILED" }));
    }
};

const deleteAvatar = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const user = await authService.deleteAvatar(userId);

        logger.info(`Avatar deleted for: ${req.user.email}`);

        return sendSuccess(
            res,
            { avatar: user.avatar },
            "Avatar reset to default"
        );
    } catch (error) {
        logger.error(`Delete avatar error: ${error.message}`);
        next(toAppError(error, { status: 400, code: "DELETE_AVATAR_FAILED" }));
    }
};

// ==================== CHANGE PASSWORD ====================

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

        const result = await authService.changePassword(userId, oldPassword, newPassword);

        logger.info(`Password changed for user: ${req.user.email}`);

        return sendSuccess(res, result, "Password updated successfully");
    } catch (error) {
        logger.error(`Change password error: ${error.message}`);
        next(toAppError(error, { status: 400, code: "PASSWORD_CHANGE_FAILED" }));
    }
};

// ==================== FORGOT PASSWORD ====================

const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email || !validateEmail(email)) {
            throw new AppError("Valid email required", 400, "INVALID_EMAIL");
        }

        await authService.forgotPassword(email);

        logger.info(`Password reset requested for: ${email}`);

        return sendSuccess(res, {}, "If the email exists, a reset link will be sent");
    } catch (error) {
        logger.error(`Forgot password error: ${error.message}`);
        return sendSuccess(res, {}, "If the email exists, a reset link will be sent");
    }
};

// ==================== RESET PASSWORD ====================

const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            throw new AppError("Token and new password required", 400, "MISSING_FIELDS");
        }

        if (!validatePassword(newPassword)) {
            throw new AppError(
                "Password must be at least 8 characters with uppercase, lowercase and number",
                400,
                "WEAK_PASSWORD"
            );
        }

        const result = await authService.resetPassword(token, newPassword);

        logger.info("Password reset successful");

        return sendSuccess(res, {}, result.message || "Password reset successful");
    } catch (error) {
        logger.error(`Reset password error: ${error.message}`);
        next(toAppError(error, { status: 400, code: "RESET_FAILED" }));
    }
};

// ==================== VERIFY EMAIL ====================

const verifyEmail = async (req, res, next) => {
    try {
        const token = req.query.token || req.body.token;

        if (!token) {
            throw new AppError("Verification token is required", 400, "TOKEN_REQUIRED");
        }

        const result = await authService.verifyEmail(token);

        return sendSuccess(
            res,
            result,
            result.alreadyVerified ? "Email is already verified." : "Email verified successfully!"
        );
    } catch (error) {
        logger.error(`Verify email error: ${error.message}`);
        next(toAppError(error));
    }
};

// ==================== RESEND VERIFICATION ====================

const resendVerification = async (req, res, next) => {
    try {
        const { email } = req.body;

        if (!email || !validateEmail(email)) {
            throw new AppError("Valid email required", 400, "INVALID_EMAIL");
        }

        const result = await authService.resendVerification(email);

        logger.info(`Verification email resent to: ${email}`);

        return sendSuccess(res, { email: result.email }, "Verification email sent successfully");
    } catch (error) {
        logger.error(`Resend verification error: ${error.message}`);
        next(toAppError(error));
    }
};

// ==================== GOOGLE LOGIN ====================

const googleLogin = async (req, res, next) => {
    try {
        const { idToken } = req.body || {};

        if (!idToken) {
            throw new AppError("Google ID token is required", 400, "MISSING_GOOGLE_TOKEN");
        }

        const clientIP = req.ip || req.connection?.remoteAddress;
        const userAgent = req.headers["user-agent"] || null;
        const tabId = req.headers["x-tab-id"] || req.body?.tabId || null;

        const result = await authService.googleLogin(idToken, clientIP, userAgent, tabId);

        return sendSuccess(
            res,
            {
                user: result.user,
                token: result.token,
                refreshToken: result.refreshToken,
                sessionId: result.sessionId,
                tabId: result.tabId,
                expiresIn: result.expiresIn,
            },
            "Google login successful"
        );
    } catch (error) {
        logger.error(`Google login error: ${error.message}`);
        next(toAppError(error, { status: 401, code: "GOOGLE_AUTH_FAILED" }));
    }
};

// ==================== EXPORT ====================

module.exports = {
    // Authentication
    register,
    login,
    googleLogin,
    refresh,
    logout,
    forkSession,

    // User Profile
    getProfile,
    updateProfile,
    updateAvatar,        // ✅
    deleteAvatar,        // ✅
    changePassword,

    // Password Reset
    forgotPassword,
    resetPassword,

    // Email Verification
    verifyEmail,
    resendVerification,
};