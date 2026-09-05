const bcrypt = require("bcrypt");
const crypto = require("crypto");
const AppError = require("../utils/AppError");
const { PrismaClient } = require("@prisma/client");
const { addToken } = require("../utils/tokenBlacklist");
const { OAuth2Client } = require("google-auth-library");
const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);
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
const { sendPasswordResetEmail, sendVerificationEmail } = require("./email.service");
const {
    generateResetToken,
    verifyResetToken,
} = require("../utils/resetToken");
// ==================== ROLE MAPPING ====================

const ROLE_MAP = {
    1: "ADMIN",
    2: "OPERATOR",
    4: "AGENT",
    5: "CITIZEN"
};

const VALID_ROLES = Object.values(ROLE_MAP);

const normalizeRole = (roleOrId) => {
    if (!roleOrId) return "CITIZEN";

    // ប្រសិនបើជា number
    if (typeof roleOrId === "number") {
        return ROLE_MAP[roleOrId] || "CITIZEN";
    }

    // ប្រសិនបើជា string
    const value = String(roleOrId).trim().toUpperCase();

    // ប្រសិនបើជា role name
    if (VALID_ROLES.includes(value)) {
        return value;
    }

    // ប្រសិនបើជា number string
    if (/^\d+$/.test(value)) {
        return ROLE_MAP[Number(value)] || "CITIZEN";
    }

    return "CITIZEN";
};

// ==================== AUTHENTICATION SERVICES ====================

/**
 * Register a new user
 */
const register = async (data) => {
    try {

        // Validate input
        if (
            !data.fullName ||
            !data.username ||
            !data.email ||
            !data.password ||
            !data.phone
        ) {
            throw new Error(
                "Missing required fields: fullName, username, email, password, phone"
            );
        }

        if (!validateEmail(data.email)) {
            throw new Error("Invalid email format");
        }

        if (!validatePassword(data.password)) {
            throw new Error(
                "Password must be at least 8 characters with uppercase, lowercase, and number"
            );
        }

        const emailClean = data.email.toLowerCase().trim();

        // Check email
        const existUser = await prisma.user.findUnique({
            where: {
                email: emailClean
            }
        });

        if (existUser) {
            throw new Error("Email already registered");
        }

        // Check username
        const existUsername = await prisma.user.findUnique({
            where: {
                username: data.username.trim()
            }
        });

        if (existUsername) {
            throw new Error("Username already exists");
        }

        // Hash password
        const hashPassword = await bcrypt.hash(data.password, 10);

        // Find or get the role
        const roleName = normalizeRole(data.role || "CITIZEN");
        const role = await prisma.role.findUnique({
            where: { name: roleName }
        });

        if (!role) {
            throw new Error(`Role "${roleName}" not found`);
        }

        // Create user
        const user = await prisma.user.create({
            data: {
                fullName: data.fullName.trim(),
                username: data.username.trim(),
                email: emailClean,
                password: hashPassword,
                phone: data.phone.trim(),
                roleId: role.id,
                status: "ACTIVE",
                emailVerified: false
            }
        });
        const rawToken = crypto.randomBytes(32).toString("hex");

        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        const expiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        await prisma.emailVerificationToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt
            }
        });
        logger.info(
            `New user registered: ${user.email}`
        );
        const verifyUrl =
            `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}`;

        await sendVerificationEmail(
            user.email,
            verifyUrl
        );
        return {
            userId: user.id,
            email: user.email,
            fullName: user.fullName
        };

    } catch (error) {

        logger.error(error.message);

        throw error;

    }
};
/**
 * Login user
 */
const login = async (email, password, ipAddress = null) => {
    try {
        if (!email || !password) {
            throw new Error("Email and password required");
        }

        const emailClean = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
            where: {
                email: emailClean
            }
        });

        if (!user) {
            throw new Error("Invalid credentials");
        }

        // Check account status
        if (user.status === "BLOCKED") {
            throw new Error(
                "Account has been blocked. Please contact administrator."
            );
        }

        // Check password
        const checkPassword = await bcrypt
            .compare(password, user.password)
            .catch(() => false);

        if (!checkPassword) {
            throw new Error("Invalid credentials");
        }
        console.log("EMAIL VERIFIED:", user.emailVerified);
        // Check email verification
        if (!user.emailVerified) {
            throw new AppError(
                "Please verify your email before logging in.",
                403,
                "EMAIL_NOT_VERIFIED"
            );
        }

        // Generate access token
        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName
        });

        // Generate refresh token
       const refreshToken = crypto.randomBytes(64).toString("hex");

const refreshExpiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
);

await prisma.refreshToken.create({
    data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: refreshExpiresAt,
    },
});

        // Remove password
        const {
            password: _,
            ...safeUser
        } = user;

        return {
            user: safeUser,
            token,
            refreshToken,
            expiresIn: "24h"
        };

    } catch (error) {
        logger.error(
            `Login error: ${error.message}`
        );

        throw error;
    }
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (refreshToken) => {
    try {
        if (!refreshToken) {
            throw new Error("Refresh token required");
        }

        // Find refresh token
        const storedToken =
            await prisma.refreshToken.findUnique({
                where: {
                    token: refreshToken,
                },
            });

        if (!storedToken) {
            throw new Error("Invalid refresh token");
        }

        // Check revoked
        if (storedToken.revokedAt) {
            throw new Error("Refresh token revoked");
        }

        // Check expiration
        if (storedToken.expiresAt <= new Date()) {
            throw new Error("Refresh token expired");
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: {
                id: storedToken.userId,
            },
        });

        if (!user) {
            throw new Error("User not found");
        }

        // =========================
        // ROTATION
        // =========================

        // Revoke old token
        await prisma.refreshToken.update({
            where: {
                id: storedToken.id,
            },
            data: {
                revokedAt: new Date(),
            },
        });

        // Generate new refresh token
        const newRefreshToken =
            crypto.randomBytes(64).toString("hex");

        const expiresAt = new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
        );

        await prisma.refreshToken.create({
            data: {
                token: newRefreshToken,
                userId: user.id,
                expiresAt,
            },
        });

        // Generate new access token
        const newToken = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
        });

        return {
            token: newToken,
            refreshToken: newRefreshToken,
            expiresIn: "24h",
        };

    } catch (error) {
        logger.error(
            `Refresh token error: ${error.message}`
        );

        throw error;
    }
};
/**
 * Logout user
 */
const logout = async (token) => {

    if (token) {
        addToken(token);
    }

    logger.info("User logged out");

    return {
        message: "Logged out successfully"
    };
};

// ==================== USER PROFILE SERVICES ====================

/**
 * Get user profile
 */
const getUserProfile = async (userId) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                organization: true
            }
        });

        if (!user) {
            throw new Error("User not found");
        }

        const { password, ...safeUser } = user;
        return safeUser;

    } catch (error) {
        logger.error(`Get user profile error: ${error.message}`);
        throw error;
    }
};

/**
 * Update user profile
 */
const updateProfile = async (userId, updates) => {
    try {

        const data = {};


        // Update Full Name
        if (updates.fullName) {
            data.fullName = updates.fullName.trim();
        }


        // Update Email
        if (updates.email) {

            if (!validateEmail(updates.email)) {
                throw new Error("Invalid email format");
            }


            const emailClean = updates.email
                .toLowerCase()
                .trim();


            // Check duplicate email
            const existingUser = await prisma.user.findUnique({
                where: {
                    email: emailClean
                }
            });


            if (existingUser && existingUser.id !== userId) {
                throw new Error("Email already in use");
            }


            data.email = emailClean;
        }



        // Update Phone
        if (updates.phone) {
            data.phone = updates.phone.trim();
        }



        // Update Avatar
        if (updates.avatar) {
            data.avatar = updates.avatar;
        }



        // Check update data
        if (Object.keys(data).length === 0) {
            throw new Error(
                "No profile fields provided"
            );
        }



        const user = await prisma.user.update({

            where: {
                id: userId
            },

            data,

            include: {
                organization: true
            }

        });



        // Remove password
        const {
            password,
            ...safeUser
        } = user;



        logger.info(
            `Profile updated for user: ${user.email}`
        );


        return safeUser;



    } catch (error) {

        logger.error(
            `Update profile error: ${error.message}`
        );

        throw error;

    }
};
// ==================== PASSWORD RESET SERVICES ====================

/**
 * Request password reset
 */
const forgotPassword = async (email) => {
    try {
        if (!email) {
            throw new Error("Email is required");
        }

        const emailClean = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
            where: {
                email: emailClean,
            },
        });

        // Don't reveal whether email exists
        if (!user) {
            logger.info(
                `Password reset requested for unknown email: ${emailClean}`
            );

            return {
                message:
                    "If the email exists, a reset link will be sent.",
            };
        }

        // Generate token + hash + save to DB
        const rawToken = await generateResetToken(user.id);

        // Create reset URL
        const resetUrl =
            `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

        // Send reset email
        await sendPasswordResetEmail(
            user.email,
            resetUrl
        );

        logger.info(
            `Password reset email sent to ${user.email}`
        );

        return {
            message:
                "If the email exists, a reset link will be sent.",
        };

    } catch (error) {
        logger.error(
            `Forgot password error: ${error.message}`
        );

        throw error;
    }
};


/**
 * Reset password with token
 */
const resetPassword = async (token, newPassword) => {
    try {
        // ===========================
        // Validate input
        // ===========================
        if (!token || !newPassword) {
            throw new Error(
                "Token and new password required"
            );
        }

        // ===========================
        // Verify reset token
        // ===========================
        const resetToken =
            await verifyResetToken(token);

        console.log(
            "RESET TOKEN:",
            resetToken
        );

        console.log(
            "USER ID:",
            resetToken.userId
        );

        // ===========================
        // Find user
        // ===========================
        const user =
            await prisma.user.findUnique({
                where: {
                    id: resetToken.userId,
                },
            });

        if (!user) {
            throw new Error(
                "User not found"
            );
        }

        // ===========================
        // Check current password
        // ===========================
        if (user.password) {
            const samePassword =
                await bcrypt.compare(
                    newPassword,
                    user.password
                );

            if (samePassword) {
                throw new Error(
                    "New password must be different from current password"
                );
            }
        }

        // ===========================
        // Hash new password
        // ===========================
        const hashedPassword =
            await bcrypt.hash(
                newPassword,
                10
            );

        // ===========================
        // Update password
        // ===========================
        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                password: hashedPassword,
                lastPasswordChange: new Date(),
                failedLoginAttempts: 0,
            },
        });

        // ===========================
        // Delete reset token
        // Token can only be used once
        // ===========================
        await prisma.passwordResetToken.delete({
            where: {
                id: resetToken.id,
            },
        });

        // ===========================
        // Logout all existing sessions
        // ===========================
        await prisma.refreshToken.deleteMany({
            where: {
                userId: user.id,
            },
        });

        logger.info(
            `Password reset successful for ${user.email}`
        );

        return {
            message:
                "Password updated successfully",
        };

    } catch (error) {
        logger.error(
            `Reset password error: ${error.message}`
        );

        throw error;
    }
};
/**
 * Change user password
 */
const changePassword = async (userId, oldPassword, newPassword) => {
    try {

        // ===========================
        // Validate input
        // ===========================
        if (!oldPassword || !newPassword) {
            throw new Error(
                "Old password and new password required"
            );
        }

        if (!validatePassword(newPassword)) {
            throw new Error(
                "Password must be at least 8 characters with uppercase, lowercase, and number"
            );
        }

        // ===========================
        // Find user
        // ===========================
        const user = await prisma.user.findUnique({
            where: {
                id: userId
            }
        });

        if (!user) {
            throw new Error("User not found");
        }

        // ===========================
        // Verify current password
        // ===========================
        const isValid = await bcrypt.compare(
            oldPassword,
            user.password
        );

        if (!isValid) {
            throw new Error(
                "Current password is incorrect"
            );
        }

        // ===========================
        // CHANGED:
        // Don't allow same password
        // ===========================
        const samePassword = await bcrypt.compare(
            newPassword,
            user.password
        );

        if (samePassword) {
            throw new Error(
                "New password must be different from current password"
            );
        }

        // ===========================
        // Hash new password
        // ===========================
        const hashedPassword = await bcrypt.hash(
            newPassword,
            10
        );

        // ===========================
        // Update password
        // ===========================
        await prisma.user.update({
            where: {
                id: userId
            },
            data: {

                // CHANGED
                password: hashedPassword,

                // CHANGED
                lastPasswordChange: new Date(),

                // CHANGED
                failedLoginAttempts: 0

            }
        });

        // ===========================
        // CHANGED:
        // Logout all devices
        // Delete all refresh tokens
        // ===========================
        await prisma.refreshToken.deleteMany({
            where: {
                userId: userId
            }
        });

        logger.info(
            `Password changed successfully for ${user.email}`
        );

        return {
            message: "Password updated successfully"
        };

    } catch (error) {

        logger.error(
            `Change password error: ${error.message}`
        );

        throw error;

    }
};
// ==================== EMAIL VERIFICATION SERVICES ====================


/**
 * Verify email with token
 */
const verifyEmail = async (rawToken) => {
    try {
        console.log("========== VERIFY EMAIL ==========");

        // =============================
        // 1. Check token
        // =============================
        console.log("1. Raw token from URL:");
        console.log(rawToken);

        if (!rawToken || typeof rawToken !== "string") {
            throw new Error(
                "Verification token is required"
            );
        }

        // Remove spaces accidentally included in token
        const token = rawToken.trim();

        // =============================
        // 2. Hash raw token
        // =============================
        const tokenHash = crypto
            .createHash("sha256")
            .update(token)
            .digest("hex");

        console.log("2. Generated tokenHash:");
        console.log(tokenHash);

        // =============================
        // 3. Find token in database
        // =============================
        const verificationToken =
            await prisma.emailVerificationToken.findUnique({
                where: {
                    tokenHash: tokenHash
                }
            });

        console.log("3. Database token:");
        console.log(verificationToken);

        // =============================
        // 4. Token not found
        // =============================
        if (!verificationToken) {
            throw new Error(
                "Invalid verification token"
            );
        }

        console.log("4. Token FOUND ✅");

        // =============================
        // 5. Check expiration
        // =============================
        if (
            verificationToken.expiresAt.getTime() <
            Date.now()
        ) {
            console.log("Token expired ❌");

            // Delete expired token
            await prisma.emailVerificationToken.delete({
                where: {
                    id: verificationToken.id
                }
            });

            throw new Error(
                "Verification token has expired"
            );
        }

        console.log("5. Token is still valid ✅");

        // =============================
        // 6. Find user
        // =============================
        const user = await prisma.user.findUnique({
            where: {
                id: verificationToken.userId
            }
        });

        console.log("6. User:");
        console.log(user);

        if (!user) {
            throw new Error(
                "User not found"
            );
        }

        // =============================
        // 7. Check if already verified
        // =============================
        if (user.emailVerified) {
            console.log(
                "Email already verified ✅"
            );

            return {
                userId: user.id,
                email: user.email,
                emailVerified: true,
                alreadyVerified: true
            };
        }

        // =============================
        // 8. Verify email
        // =============================
        await prisma.$transaction([
            prisma.user.update({
                where: {
                    id: user.id
                },
                data: {
                    emailVerified: true
                }
            }),

            prisma.emailVerificationToken.delete({
                where: {
                    id: verificationToken.id
                }
            })
        ]);

        console.log(
            "7. Email verified successfully ✅"
        );

        // =============================
        // 9. Return result
        // =============================
        return {
            userId: user.id,
            email: user.email,
            emailVerified: true,
            alreadyVerified: false
        };

    } catch (error) {
        console.error(
            "VERIFY EMAIL ERROR:",
            error.message
        );

        throw error;
    }
};

/**
 * Resend verification email
 */
const resendVerification = async (email) => {
    try {
        const emailClean = email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
            where: {
                email: emailClean,
            },
        });

        if (!user) {
            throw new AppError(
                "User not found",
                404,
                "USER_NOT_FOUND"
            );
        }

        if (user.emailVerified) {
            throw new AppError(
                "Email already verified",
                400,
                "EMAIL_ALREADY_VERIFIED"
            );
        }

        // Delete old verification tokens
        await prisma.emailVerificationToken.deleteMany({
            where: {
                userId: user.id,
            },
        });

        // Generate new token
        const rawToken = crypto
            .randomBytes(32)
            .toString("hex");

        const tokenHash = crypto
            .createHash("sha256")
            .update(rawToken)
            .digest("hex");

        // Token expires in 24 hours
        const expiresAt = new Date(
            Date.now() + 24 * 60 * 60 * 1000
        );

        await prisma.emailVerificationToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            },
        });

        // Verification URL
        const verifyUrl =
            `${process.env.FRONTEND_URL}/verify-email?token=${rawToken}`;

        // Send email
        await sendVerificationEmail(
            user.email,
            verifyUrl
        );

        logger.info(
            `Verification email resent to: ${user.email}`
        );

        return {
            email: user.email,
            message: "Verification email sent",
        };

    } catch (error) {
        logger.error(
            `Resend verification error: ${error.message}`
        );

        throw error;
    }
};
const googleLogin = async (idToken) => {
    try {
        if (!idToken) {
            throw new Error("Google ID token is required");
        }

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();

        if (!payload) {
            throw new Error("Invalid Google token");
        }

        const {
            sub: googleId,
            email,
            name,
            picture,
            email_verified
        } = payload;

        if (!email || !email_verified) {
            throw new Error(
                "Google email is not verified"
            );
        }

        const emailClean = email.toLowerCase().trim();

        let user = await prisma.user.findUnique({
            where: {
                email: emailClean
            }
        });

        // Create new user
        if (!user) {
            const username =
                emailClean
                    .split("@")[0]
                    .replace(/[^a-zA-Z0-9]/g, "")
                    .toLowerCase();

            const randomPassword =
                require("crypto")
                    .randomBytes(32)
                    .toString("hex");

            const hashedPassword =
                await bcrypt.hash(randomPassword, 10);

            user = await prisma.user.create({
                data: {
                    fullName: name || username,
                    username: `${username}_${Date.now()}`,
                    email: emailClean,
                    password: hashedPassword,
                    phone: "N/A",
                    avatar:
                        picture ||
                        "account-avatar-profile-user.svg",
                    roleId: 5,
                    status: "ACTIVE"
                }
            });
        }

        if (user.status === "BLOCKED") {
            throw new Error(
                "Account has been blocked. Please contact administrator."
            );
        }

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.roleId,
            fullName: user.fullName
        });

        const refreshToken =
            generateRefreshToken({
                id: user.id
            });

        const {
            password: _,
            ...safeUser
        } = user;

        return {
            user: safeUser,
            token,
            refreshToken,
            expiresIn: "24h"
        };

    } catch (error) {
        logger.error(
            `Google login error: ${error.message}`
        );

        throw error;
    }
};

// ==================== APPLE LOGIN ====================

const appleLogin = async (identityToken, authorizationCode = null) => {
    try {
        // =========================
        // Validate token
        // =========================

        if (!identityToken) {
            throw new Error("Apple identity token is required");
        }

        // =========================
        // Verify Apple Identity Token
        // =========================

        const appleData = await appleSignin.verifyIdToken(
            identityToken,
            {
                audience: process.env.APPLE_CLIENT_ID
            }
        );

        if (!appleData) {
            throw new Error("Invalid Apple identity token");
        }

        // =========================
        // Get Apple information
        // =========================

        const appleId = appleData.sub;
        const email = appleData.email;
        const emailVerified = appleData.email_verified;

        if (!appleId) {
            throw new Error("Apple ID not found");
        }

        if (!email) {
            throw new Error("Apple email not found");
        }

        if (
            emailVerified !== true &&
            emailVerified !== "true"
        ) {
            throw new Error("Apple email is not verified");
        }

        const emailClean = email.toLowerCase().trim();

        // =========================
        // Find by Apple ID
        // =========================

        let user = await prisma.user.findUnique({
            where: {
                appleId: appleId
            }
        });

        // =========================
        // If not found, find by email
        // =========================

        if (!user) {
            user = await prisma.user.findUnique({
                where: {
                    email: emailClean
                }
            });

            // Existing email account
            if (user) {
                user = await prisma.user.update({
                    where: {
                        id: user.id
                    },
                    data: {
                        appleId: appleId
                    }
                });
            }
        }

        // =========================
        // Create new user
        // =========================

        if (!user) {

            const usernameBase =
                emailClean
                    .split("@")[0]
                    .replace(/[^a-zA-Z0-9]/g, "")
                    .toLowerCase() || "appleuser";

            const username =
                `${usernameBase}_${Date.now()}`;

            const randomPassword =
                crypto.randomBytes(32).toString("hex");

            const hashedPassword =
                await bcrypt.hash(randomPassword, 10);

            user = await prisma.user.create({
                data: {
                    fullName: "Apple User",
                    username,
                    email: emailClean,
                    password: hashedPassword,
                    phone: "N/A",
                    avatar: null,

                    // CITIZEN
                    roleId: 5,

                    status: "ACTIVE",
                    appleId: appleId
                }
            });
        }

        // =========================
        // Check account status
        // =========================

        if (user.status === "BLOCKED") {
            throw new Error(
                "Account has been blocked. Please contact administrator."
            );
        }

        if (user.status !== "ACTIVE") {
            throw new Error(
                "Account is not active"
            );
        }

        // =========================
        // Generate JWT
        // =========================

        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.roleId,
            fullName: user.fullName
        });

        const refreshToken =
            generateRefreshToken({
                id: user.id
            });

        // =========================
        // Remove password
        // =========================

        const {
            password: _,
            ...safeUser
        } = user;

        logger.info(
            `Apple login successful: ${user.email}`
        );

        return {
            user: safeUser,
            token,
            refreshToken,
            expiresIn: "24h"
        };

    } catch (error) {

        logger.error(
            `Apple login error: ${error.message}`
        );

        throw error;
    }
};

// ==================== EXPORT SERVICES ====================

module.exports = {
    // Authentication
    register,
    login,
    googleLogin,
    appleLogin,
    refreshAccessToken,
    logout,

    // User Profile
    getUserProfile,
    updateProfile,
    changePassword,

    // Password Reset
    forgotPassword,
    resetPassword,

    // Email Verification
    verifyEmail,
    resendVerification,
};