const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AppError = require("../utils/AppError");
const { PrismaClient } = require("@prisma/client");
const { addToken } = require("../utils/tokenBlacklist");
const { OAuth2Client } = require("google-auth-library");
const { deleteOldFile, getStoredPath } = require("../middleware/upload.middleware");

// ✅ Import constants
const {
    DEFAULT_AVATAR,
    ROLES,
    ROLE_MAP,
    VALID_GENDERS,
} = require("../utils/constants");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const {
    generateToken,
    generateRefreshToken,
    generateVerifyToken,
    verifyVerifyToken,
    verifyRefreshToken,
    blacklistToken,
} = require("../utils/jwt");

const { validateEmail, validatePassword } = require("../utils/validators");
const logger = require("../utils/logger");

const prisma = new PrismaClient();

const {
    sendPasswordResetEmail,
    sendVerificationEmail,
} = require("./email.service");

const {
    generateResetToken,
    verifyResetToken,
} = require("../utils/resetToken");

// ✅ helpers
const {
    checkUserActive,
    checkUserForLogin,
    checkUserForOAuth,
    checkUserForRefresh,
    checkUserForVerification,
    checkUserForUpdate,
    canSendPasswordReset,
    checkDuplicateField,
} = require("../utils/authHelpers");

// ==================== ROLE MAPPING ====================

const VALID_ROLES = Object.values(ROLE_MAP);

const normalizeRole = (roleOrId) => {
    if (!roleOrId) return ROLES.CITIZEN;
    if (typeof roleOrId === "number") return ROLE_MAP[roleOrId] || ROLES.CITIZEN;
    const value = String(roleOrId).trim().toUpperCase();
    if (VALID_ROLES.includes(value)) return value;
    if (/^\d+$/.test(value)) return ROLE_MAP[Number(value)] || ROLES.CITIZEN;
    return ROLES.CITIZEN;
};

// ==================== HELPERS ====================

/**
 * ✅ បំប្លែង user object → safeUser (role ជា string)
 */
const sanitizeUser = (user) => {
    if (!user) return null;
    const { password, role, ...rest } = user;
    return {
        ...rest,
        role: role?.name || null,          // ✅ "ADMIN"
        roleId: role?.id ?? user.roleId ?? null,   // ✅ 1
    };
};

/**
 * បង្កើត verification token + ផ្ញើ email
 */
const createAndSendVerification = async (userId, email) => {
    await prisma.emailVerificationToken.deleteMany({ where: { userId } });

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await prisma.emailVerificationToken.create({
        data: { userId, tokenHash, expiresAt },
    });

    const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}`;
    await sendVerificationEmail(email, verifyUrl);

    return rawToken;
};

/**
 * បង្កើត refresh token
 */
const createRefreshToken = async (userId) => {
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
        data: { token: refreshToken, userId, expiresAt },
    });

    return refreshToken;
};

/**
 * បង្កើត session សម្រាប់ Server-Managed Sessions + Tab ID
 *
 * ⚠️  DO NOT revoke by (userId + tabId) here.
 *     Revoking on login would kill Tab 1 when Tab 2 re-logs in
 *     after being duplicated from Tab 1 (both share the same tabId
 *     from sessionStorage until Tab 2 refreshes and generates a new one).
 *
 *     Callers that need to rotate a specific session (refresh flow)
 *     revoke the OLD session themselves BEFORE calling createSession.
 */
const createSession = async ({ userId, tabId = null, userAgent = null, ipAddress = null }) => {
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await prisma.session.create({
        data: {
            userId,
            tabId: tabId || null,
            userAgent: userAgent || null,
            ipAddress: ipAddress || null,
            refreshToken,
            expiresAt,
        },
    });

    // Sync legacy refreshToken table (best-effort — never throw)
    await prisma.refreshToken.create({
        data: { token: refreshToken, userId, expiresAt },
    }).catch(() => {});

    return {
        sessionId: session.id,
        tabId: session.tabId,
        refreshToken: session.refreshToken,
    };
};

// ==================== REGISTER ====================

const register = async (data) => {
    try {
        if (!data.fullName || !data.username || !data.email || !data.password || !data.phone) {
            throw new Error("Missing required fields: fullName, username, email, password, phone");
        }

        if (!validateEmail(data.email)) {
            throw new Error("Invalid email format");
        }

        if (!validatePassword(data.password)) {
            throw new Error("Password must be at least 8 characters with uppercase, lowercase, and number");
        }

        const emailClean = data.email.toLowerCase().trim();

        const existUser = await prisma.user.findUnique({ where: { email: emailClean } });
        checkDuplicateField(existUser, "email");

        const existUsername = await prisma.user.findUnique({
            where: { username: data.username.trim() },
        });
        checkDuplicateField(existUsername, "username");

        const hashPassword = await bcrypt.hash(data.password, 10);

        const roleName = normalizeRole(data.role || ROLES.CITIZEN);
        const role = await prisma.role.findUnique({ where: { name: roleName } });
        if (!role) throw new Error(`Role "${roleName}" not found`);

        let birthday = null;
        if (data.birthday) {
            birthday = data.birthday instanceof Date ? data.birthday : new Date(data.birthday);
            if (isNaN(birthday.getTime())) throw new Error("Invalid birthday format");
            if (birthday > new Date()) throw new Error("Birthday cannot be in the future");
        }

        let gender = null;
        if (data.gender) {
            const g = String(data.gender).trim().toUpperCase();
            if (!VALID_GENDERS.includes(g)) {
                throw new Error("Invalid gender value");
            }
            gender = g;
        }

        const user = await prisma.user.create({
            data: {
                fullName: data.fullName.trim(),
                username: data.username.trim(),
                email: emailClean,
                password: hashPassword,
                phone: data.phone.trim(),
                roleId: role.id,
                status: "ACTIVE",
                emailVerified: false,
                birthday,
                gender,
                avatar: DEFAULT_AVATAR,
            },
        });

        await createAndSendVerification(user.id, user.email);

        logger.info(`New user registered: ${user.email}`);

        return {
            userId: user.id,
            email: user.email,
            fullName: user.fullName,
            role: role.name,
            birthday: user.birthday,
            gender: user.gender,
            requiresVerification: true,
        };
    } catch (error) {
        logger.error(`Register error: ${error.message}`);
        throw error;
    }
};

// ==================== LOGIN ====================

const login = async (email, password, ipAddress = null, userAgent = null, tabId = null) => {
    try {
        if (!email || !password) {
            throw new Error("Email and password required");
        }

        const emailClean = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
            where: { email: emailClean },
            include: { role: true },
        });

        checkUserForLogin(user, { requireEmailVerified: true });

        const checkPassword = await bcrypt.compare(password, user.password).catch(() => false);
        if (!checkPassword) {
            throw new Error("Invalid credentials");
        }

        // ✅ BUG 1 FIX: createSession FIRST so sessionId is available for the JWT
        const session = await createSession({
            userId: user.id,
            tabId,
            userAgent,
            ipAddress,
        });

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role?.name,
            fullName: user.fullName,
            sessionId: session.sessionId,   // ✅ embedded in JWT
            tabId: session.tabId,
        });

        const safeUser = sanitizeUser(user);

        logger.info(`User logged in: ${user.email} from ${ipAddress || "unknown"} (tabId: ${tabId || "none"}, sessionId: ${session.sessionId})`);

        return {
            user: safeUser,
            token,
            refreshToken: session.refreshToken,
            sessionId: session.sessionId,
            tabId: session.tabId,
            expiresIn: "24h",
        };
    } catch (error) {
        logger.error(`Login error: ${error.message}`);
        throw error;
    }
};

// ==================== REFRESH ACCESS TOKEN ====================

const refreshAccessToken = async (refreshToken, tabId = null) => {
    try {
        if (!refreshToken) {
            throw new Error("Refresh token required");
        }

        // 1. Primary lookup: Session table
        let session = await prisma.session.findUnique({
            where: { refreshToken },
        });

        let userId = session?.userId;

        // 2. Fallback: legacy RefreshToken table
        if (!session) {
            const legacyToken = await prisma.refreshToken.findUnique({
                where: { token: refreshToken },
            });
            if (legacyToken) {
                userId = legacyToken.userId;
                if (legacyToken.revokedAt) throw new Error("Refresh token revoked");
                if (legacyToken.expiresAt <= new Date()) throw new Error("Refresh token expired");
            }
        } else {
            if (session.revokedAt) throw new Error("Refresh token revoked");
            if (session.expiresAt <= new Date()) throw new Error("Refresh token expired");
        }

        if (!userId) throw new Error("Invalid refresh token");

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { role: true },
        });

        checkUserForRefresh(user);

        // Revoke ONLY the specific session being rotated — never revoke by userId
        if (session) {
            await prisma.session.update({
                where: { id: session.id },
                data: { revokedAt: new Date() },
            });
        }
        // Revoke matching legacy row only (by exact token value, not by userId)
        await prisma.refreshToken.updateMany({
            where: { token: refreshToken },
            data: { revokedAt: new Date() },
        }).catch(() => {});

        // ✅ BUG 1 FIX: createSession FIRST so sessionId is available for the JWT
        const activeTabId = tabId || session?.tabId || null;
        const newSession = await createSession({
            userId: user.id,
            tabId: activeTabId,
            userAgent: session?.userAgent || null,
            ipAddress: session?.ipAddress || null,
        });

        const newToken = generateToken({
            id: user.id,
            email: user.email,
            role: user.role?.name,
            fullName: user.fullName,
            sessionId: newSession.sessionId,   // ✅ embedded in JWT
            tabId: activeTabId,
        });

        return {
            token: newToken,
            refreshToken: newSession.refreshToken,
            sessionId: newSession.sessionId,
            tabId: newSession.tabId,
            expiresIn: "24h",
        };
    } catch (error) {
        logger.error(`Refresh token error: ${error.message}`);
        throw error;
    }
};

// ==================== LOGOUT ====================

const logout = async (token, refreshToken = null, tabId = null) => {
    try {
        // ✅ Blacklist the access token immediately
        if (token) {
            addToken(token);
        }

        // ✅ Revoke ONLY the specific session by its unique refreshToken
        if (refreshToken) {
            await prisma.session.updateMany({
                where: { refreshToken, revokedAt: null },
                data: { revokedAt: new Date() },
            });

            await prisma.refreshToken.updateMany({
                where: { token: refreshToken, revokedAt: null },
                data: { revokedAt: new Date() },
            }).catch(() => {});
        } else if (token) {
            // ✅ Fallback: Revoke strictly by the specific sessionId embedded in this JWT token
            try {
                const decoded = jwt.decode(token);
                if (decoded && decoded.sessionId) {
                    await prisma.session.updateMany({
                        where: { id: decoded.sessionId, revokedAt: null },
                        data: { revokedAt: new Date() },
                    });
                }
            } catch {
                // ignore decode error
            }
        }

        // ⚠️ CRITICAL: NEVER revoke by tabId!
        // Duplicate tabs or shared tab IDs must never cause cross-session revocation.

        logger.info(`User logged out (refreshToken: ${refreshToken ? 'provided' : 'none'}, tabId: ${tabId || "none"})`);
        return { message: "Logged out successfully" };
    } catch (error) {
        logger.error(`Logout error: ${error.message}`);
        throw error;
    }
};

// ==================== FORK SESSION ====================

const forkSession = async (user, tabId = null, ipAddress = null, userAgent = null) => {
    try {
        if (!user || !user.id) {
            throw new Error("User authentication required to fork session");
        }

        const session = await createSession({
            userId: user.id,
            tabId,
            userAgent,
            ipAddress,
        });

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            sessionId: session.sessionId,
            tabId: session.tabId,
        });

        logger.info(`Session forked for user ${user.email} (new tabId: ${tabId}, new sessionId: ${session.sessionId})`);

        return {
            user,
            token,
            refreshToken: session.refreshToken,
            sessionId: session.sessionId,
            tabId: session.tabId,
            expiresIn: "24h",
        };
    } catch (error) {
        logger.error(`Fork session error: ${error.message}`);
        throw error;
    }
};

// ==================== GET USER PROFILE ====================

const getUserProfile = async (userId) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { role: true, organization: true },
        });

        checkUserForUpdate(user);

        // ✅ role ជា string
        return sanitizeUser(user);
    } catch (error) {
        logger.error(`Get user profile error: ${error.message}`);
        throw error;
    }
};

// ==================== UPDATE PROFILE ====================

const updateProfile = async (userId, updates) => {
    try {
        const existing = await prisma.user.findUnique({ where: { id: userId } });
        checkUserForUpdate(existing);

        const data = {};

        if (updates.fullName) {
            data.fullName = updates.fullName.trim();
        }

        if (updates.email) {
            if (!validateEmail(updates.email)) {
                throw new Error("Invalid email format");
            }
            const emailClean = updates.email.toLowerCase().trim();
            const dup = await prisma.user.findUnique({ where: { email: emailClean } });
            if (dup && dup.id !== userId && !dup.deletedAt) {
                throw new Error("Email already in use");
            }
            data.email = emailClean;
        }

        if (updates.phone) {
            data.phone = updates.phone.trim();
        }

        // ✅ Birthday
        if (updates.birthday !== undefined) {
            if (updates.birthday === "" || updates.birthday === null) {
                data.birthday = null;
            } else {
                const dt = new Date(updates.birthday);
                if (isNaN(dt.getTime())) throw new Error("Invalid birthday format");
                if (dt > new Date()) throw new Error("Birthday cannot be in the future");
                data.birthday = dt;
            }
        }

        // ✅ Gender
        if (updates.gender !== undefined) {
            if (updates.gender === "" || updates.gender === null) {
                data.gender = null;
            } else {
                const g = String(updates.gender).trim().toUpperCase();
                if (!VALID_GENDERS.includes(g)) {
                    throw new Error("Invalid gender value");
                }
                data.gender = g;
            }
        }

        // ✅ Avatar
        if (updates.file) {
            if (existing.avatar) deleteOldFile(existing.avatar);
            data.avatar = getStoredPath(updates.file);
        } else if (updates.avatar) {
            if (existing.avatar && existing.avatar !== updates.avatar) {
                deleteOldFile(existing.avatar);
            }
            data.avatar = updates.avatar;
        }

        if (Object.keys(data).length === 0) {
            throw new Error("No profile fields provided");
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data,
            include: { role: true, organization: true },
        });

        // ✅ role ជា string
        const safeUser = sanitizeUser(user);
        logger.info(`Profile updated for user: ${user.email}`);
        return safeUser;
    } catch (error) {
        logger.error(`Update profile error: ${error.message}`);
        throw error;
    }
};

// ==================== AVATAR ====================

const updateAvatar = async (userId, file) => {
    try {
        const existing = await prisma.user.findUnique({ where: { id: userId } });
        checkUserForUpdate(existing);

        if (existing.avatar) deleteOldFile(existing.avatar);

        const user = await prisma.user.update({
            where: { id: userId },
            data: { avatar: getStoredPath(file) },
            include: { role: true, organization: true },
        });

        // ✅ role ជា string
        const safeUser = sanitizeUser(user);
        logger.info(`Avatar updated for: ${user.email}`);
        return safeUser;
    } catch (error) {
        logger.error(`Update avatar error: ${error.message}`);
        throw error;
    }
};

const deleteAvatar = async (userId) => {
    try {
        const existing = await prisma.user.findUnique({ where: { id: userId } });
        checkUserForUpdate(existing);

        if (existing.avatar) deleteOldFile(existing.avatar);

        const user = await prisma.user.update({
            where: { id: userId },
            data: { avatar: DEFAULT_AVATAR },
            include: { role: true, organization: true },
        });

        // ✅ role ជា string
        const safeUser = sanitizeUser(user);
        logger.info(`Avatar deleted for: ${user.email}`);
        return safeUser;
    } catch (error) {
        logger.error(`Delete avatar error: ${error.message}`);
        throw error;
    }
};

// ==================== FORGOT PASSWORD ====================

const forgotPassword = async (email) => {
    try {
        if (!email) throw new Error("Email is required");

        const emailClean = email.toLowerCase().trim();
        const user = await prisma.user.findUnique({ where: { email: emailClean } });

        if (!canSendPasswordReset(user)) {
            logger.info(`Password reset requested for inactive email: ${emailClean}`);
            return {
                message: "If the email exists, a reset link will be sent.",
            };
        }

        const rawToken = await generateResetToken(user.id);
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

        await sendPasswordResetEmail(user.email, resetUrl);

        logger.info(`Password reset email sent to ${user.email}`);
        return {
            message: "If the email exists, a reset link will be sent.",
        };
    } catch (error) {
        logger.error(`Forgot password error: ${error.message}`);
        throw error;
    }
};

// ==================== RESET PASSWORD ====================

const resetPassword = async (token, newPassword) => {
    try {
        if (!token || !newPassword) {
            throw new Error("Token and new password required");
        }

        if (!validatePassword(newPassword)) {
            throw new Error("Password must be at least 8 characters with uppercase, lowercase, and number");
        }

        const resetToken = await verifyResetToken(token);

        const user = await prisma.user.findUnique({
            where: { id: resetToken.userId },
        });

        checkUserForUpdate(user);

        if (user.password) {
            const samePassword = await bcrypt.compare(newPassword, user.password);
            if (samePassword) {
                throw new Error("New password must be different from current password");
            }
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                lastPasswordChange: new Date(),
                failedLoginAttempts: 0,
            },
        });

        await prisma.passwordResetToken.delete({
            where: { id: resetToken.id },
        });

        // Revoke ALL sessions for this user (password changed — force re-login everywhere)
        await prisma.session.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        await prisma.refreshToken.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: new Date() },
        }).catch(() => {});

        logger.info(`Password reset successful for ${user.email}`);
        return { message: "Password updated successfully" };
    } catch (error) {
        logger.error(`Reset password error: ${error.message}`);
        throw error;
    }
};

// ==================== CHANGE PASSWORD ====================

const changePassword = async (userId, oldPassword, newPassword) => {
    try {
        if (!oldPassword || !newPassword) {
            throw new Error("Old password and new password required");
        }

        if (!validatePassword(newPassword)) {
            throw new Error("Password must be at least 8 characters with uppercase, lowercase, and number");
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        checkUserForUpdate(user);

        const isValid = await bcrypt.compare(oldPassword, user.password);
        if (!isValid) throw new Error("Current password is incorrect");

        const samePassword = await bcrypt.compare(newPassword, user.password);
        if (samePassword) {
            throw new Error("New password must be different from current password");
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                lastPasswordChange: new Date(),
                failedLoginAttempts: 0,
            },
        });

        // Revoke ALL sessions for this user (password changed — force re-login everywhere)
        await prisma.session.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        });
        await prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
        }).catch(() => {});

        logger.info(`Password changed successfully for ${user.email}`);
        return { message: "Password updated successfully" };
    } catch (error) {
        logger.error(`Change password error: ${error.message}`);
        throw error;
    }
};

// ==================== VERIFY EMAIL ====================

const verifyEmail = async (rawToken) => {
    try {
        if (!rawToken || typeof rawToken !== "string") {
            throw new Error("Verification token is required");
        }

        const token = rawToken.trim();
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        const verificationToken = await prisma.emailVerificationToken.findUnique({
            where: { tokenHash },
        });

        if (!verificationToken) {
            throw new Error("Invalid verification token");
        }

        if (verificationToken.expiresAt.getTime() < Date.now()) {
            await prisma.emailVerificationToken.delete({
                where: { id: verificationToken.id },
            });
            throw new Error("Verification token has expired");
        }

        const user = await prisma.user.findUnique({
            where: { id: verificationToken.userId },
        });

        checkUserForVerification(user);

        if (user.emailVerified) {
            return {
                userId: user.id,
                email: user.email,
                emailVerified: true,
                alreadyVerified: true,
            };
        }

        await prisma.$transaction([
            prisma.user.update({
                where: { id: user.id },
                data: { emailVerified: true },
            }),
            prisma.emailVerificationToken.delete({
                where: { id: verificationToken.id },
            }),
        ]);

        logger.info(`Email verified: ${user.email}`);

        return {
            userId: user.id,
            email: user.email,
            emailVerified: true,
            alreadyVerified: false,
        };
    } catch (error) {
        logger.error(`Verify email error: ${error.message}`);
        throw error;
    }
};

// ==================== RESEND VERIFICATION ====================

const resendVerification = async (email) => {
    try {
        const emailClean = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({ where: { email: emailClean } });

        checkUserForVerification(user);

        await createAndSendVerification(user.id, user.email);

        logger.info(`Verification email resent to: ${user.email}`);
        return { email: user.email, message: "Verification email sent" };
    } catch (error) {
        logger.error(`Resend verification error: ${error.message}`);
        throw error;
    }
};

// ==================== GOOGLE LOGIN ====================

const googleLogin = async (idToken, ipAddress = null, userAgent = null, tabId = null) => {
    try {
        if (!idToken) {
            throw new Error("Google ID token is required");
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) throw new Error("Invalid Google token");

        const { sub: googleId, email, name, picture, email_verified } = payload;

        if (!email || !email_verified) {
            throw new Error("Google email is not verified");
        }

        const emailClean = email.toLowerCase().trim();

        let user = await prisma.user.findUnique({
            where: { email: emailClean },
            include: { role: true },
        });

        if (!user) {
            const username = emailClean.split("@")[0].replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
            const randomPassword = crypto.randomBytes(32).toString("hex");
            const hashedPassword = await bcrypt.hash(randomPassword, 10);

            user = await prisma.user.create({
                data: {
                    fullName: name || username,
                    username: `${username}_${Date.now()}`,
                    email: emailClean,
                    password: hashedPassword,
                    phone: "N/A",
                    avatar: picture || DEFAULT_AVATAR,
                    roleId: 5,
                    status: "ACTIVE",
                    googleId,
                    emailVerified: true,
                },
                include: { role: true },
            });
        } else if (!user.googleId) {
            user = await prisma.user.update({
                where: { id: user.id },
                data: { googleId },
                include: { role: true },
            });
        }

        checkUserForOAuth(user);

        // ✅ BUG 1 FIX: createSession FIRST so sessionId is available for the JWT
        const session = await createSession({
            userId: user.id,
            tabId,
            userAgent,
            ipAddress,
        });

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role?.name,
            fullName: user.fullName,
            sessionId: session.sessionId,   // ✅ embedded in JWT
            tabId: session.tabId,
        });

        // ✅ role ជា string
        const safeUser = sanitizeUser(user);

        logger.info(`Google login successful: ${user.email} (tabId: ${tabId || "none"}, sessionId: ${session.sessionId})`);

        return {
            user: safeUser,
            token,
            refreshToken: session.refreshToken,
            sessionId: session.sessionId,
            tabId: session.tabId,
            expiresIn: "24h",
        };
    } catch (error) {
        logger.error(`Google login error: ${error.message}`);
        throw error;
    }
};

// ==================== EXPORT ====================

module.exports = {
    // Authentication
    register,
    login,
    googleLogin,
    refreshAccessToken,
    logout,
    forkSession,

    // User Profile
    getUserProfile,
    updateProfile,
    updateAvatar,
    deleteAvatar,
    changePassword,

    // Password Reset
    forgotPassword,
    resetPassword,

    // Email Verification
    verifyEmail,
    resendVerification,
};