// utils/authHelpers.js
const logger = require("./logger");

/**
 * ============================================
 * AUTH HELPERS — ការពារ User ដែលលុប/blocked
 * ============================================
 */

/**
 * ពិនិត្យថា user មានស្ថានភាពត្រឹមត្រូវឬអត់
 */
const checkUserActive = (user) => {
    // 1. User មិនមាន
    if (!user) {
        throw new Error("User not found");
    }

    // 2. User លុបហើយ (soft delete)
    if (user.deletedAt || user.status === "DELETED") {
        throw new Error(
            "Account has been deleted. Please contact administrator."
        );
    }

    // 3. User ត្រូវបាន block
    if (user.status === "BLOCKED") {
        throw new Error(
            "Account has been blocked. Please contact administrator."
        );
    }

    // 4. User អសកម្ម
    if (user.status === "INACTIVE") {
        throw new Error(
            "Account is inactive. Please contact administrator."
        );
    }

    // 5. User រង់ចាំ verify email
    if (user.status === "PENDING_VERIFICATION") {
        throw new Error(
            "Account is pending verification. Please verify your email."
        );
    }

    // 6. Status ផ្សេងទៀត
    if (user.status !== "ACTIVE") {
        throw new Error("Account is not active");
    }

    return user;
};

/**
 * ពិនិត្យ user សម្រាប់ login
 */
const checkUserForLogin = (user, { requireEmailVerified = true } = {}) => {
    checkUserActive(user);

    if (requireEmailVerified && !user.emailVerified) {
        const err = new Error("Please verify your email before logging in.");
        err.status = 403;
        err.code = "EMAIL_NOT_VERIFIED";
        throw err;
    }

    return user;
};

/**
 * ពិនិត្យ user សម្រាប់ forgot password
 */
const canSendPasswordReset = (user) => {
    if (!user) return false;
    if (user.deletedAt || user.status === "DELETED") return false;
    if (user.status === "BLOCKED") return false;
    return true;
};

/**
 * ពិនិត្យ user សម្រាប់ resend verification email
 */
const checkUserForVerification = (user) => {
    if (!user || user.deletedAt) {
        throw new Error("User not found");
    }
    if (user.status === "DELETED") {
        throw new Error("Account has been deleted");
    }
    if (user.emailVerified) {
        const err = new Error("Email already verified");
        err.status = 400;
        err.code = "EMAIL_ALREADY_VERIFIED";
        throw err;
    }
    return user;
};

/**
 * ពិនិត្យ user សម្រាប់ OAuth (Google)
 */
const checkUserForOAuth = (user) => {
    if (!user) {
        throw new Error("User not found");
    }
    if (user.deletedAt || user.status === "DELETED") {
        throw new Error(
            "Account has been deleted. Please contact administrator."
        );
    }
    if (user.status === "BLOCKED") {
        throw new Error(
            "Account has been blocked. Please contact administrator."
        );
    }
    if (user.status !== "ACTIVE") {
        throw new Error("Account is not active");
    }
    return user;
};

/**
 * ពិនិត្យ user សម្រាប់ refresh token
 */
const checkUserForRefresh = (user) => {
    if (!user) {
        throw new Error("User not found");
    }
    if (user.deletedAt || user.status === "DELETED") {
        throw new Error("Account has been deleted");
    }
    if (user.status !== "ACTIVE") {
        throw new Error("Account is not active");
    }
    return user;
};

/**
 * ពិនិត្យថា user អាចចុះឈ្មោះជាមួយ email/username ដែលមានស្រាប់ឬអត់
 * បើ user ដែលមានស្រាប់លុបហើយ → អនុញ្ញាតឱ្យប្រើឡើងវិញ
 */
const checkDuplicateField = (existingUser, field) => {
    if (!existingUser) return;
    if (existingUser.deletedAt) return;   // ✅ លុបហើយ → អនុញ្ញាត

    const fieldName = field === "email" ? "Email" : "Username";
    const err = new Error(`${fieldName} already exists`);
    err.status = 409;
    throw err;
};

/**
 * ពិនិត្យ user មុន update profile
 */
const checkUserForUpdate = (user) => {
    if (!user || user.deletedAt) {
        throw new Error("User not found");
    }
    return user;
};

module.exports = {
    checkUserActive,
    checkUserForLogin,
    checkUserForVerification,
    checkUserForOAuth,
    checkUserForRefresh,
    checkUserForUpdate,
    canSendPasswordReset,
    checkDuplicateField,
};