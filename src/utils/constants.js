// utils/constants.js

/**
 * ============================================
 * CONSTANTS — Smart City SOS Cambodia
 * ============================================
 * Centralized constants for the entire backend
 */

// ==================== USER DEFAULTS ====================

const DEFAULT_AVATAR = "uploads/avatars/account-avatar-profile-user.svg";
const DEFAULT_BADGE = "N/A";

// ==================== ROLES ====================

const ROLES = {
    ADMIN: "ADMIN",
    OPERATOR: "OPERATOR",
    CITIZEN: "CITIZEN",
    AGENT: "AGENT",
};

const ROLE_MAP = {
    1: "ADMIN",
    2: "OPERATOR",
    3: "CITIZEN",
    4: "AGENT",
};

// ==================== USER STATUS ====================

const USER_STATUS = {
    ACTIVE: "ACTIVE",
    BLOCKED: "BLOCKED",
    INACTIVE: "INACTIVE",
    PENDING_VERIFICATION: "PENDING_VERIFICATION",
    DELETED: "DELETED",
};

const VALID_USER_STATUSES = [
    USER_STATUS.ACTIVE,
    USER_STATUS.BLOCKED,
    USER_STATUS.INACTIVE,
];

// ==================== GENDER ====================

const GENDERS = {
    MALE: "MALE",
    FEMALE: "FEMALE",
    OTHER: "OTHER",
};

const VALID_GENDERS = Object.values(GENDERS);

// ==================== UPLOAD ====================

const UPLOAD_DIRS = {
    AVATARS: "avatars",
    IMAGES: "images",
    VIDEOS: "videos",
};

const ALLOWED_IMAGE_MIME = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
];

const ALLOWED_VIDEO_MIME = [
    "video/mp4",
    "video/webm",
    "video/quicktime",
];

const ALLOWED_MIME = [...ALLOWED_IMAGE_MIME, ...ALLOWED_VIDEO_MIME];

const ALLOWED_EXT = [
    ".jpg", ".jpeg", ".png", ".webp", ".gif",
    ".mp4", ".webm", ".mov",
];

const MAX_FILE_SIZE = 20 * 1024 * 1024;   // 20 MB
const MAX_FILES = 10;

// ==================== PAGINATION ====================

const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
};

// ==================== JWT ====================

const TOKEN_EXPIRY = {
    ACCESS: "24h",
    REFRESH_DAYS: 7,
    EMAIL_VERIFICATION_HOURS: 24,
    PASSWORD_RESET_HOURS: 1,
};

// ==================== PASSWORD ====================

const PASSWORD = {
    MIN_LENGTH: 8,
    MAX_LENGTH: 128,
    SALT_ROUNDS: 10,
    PATTERN: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
};

// ==================== PHONE ====================

const PHONE_PATTERN = /^[0-9+\-\s()]{8,20}$/;

// ==================== USERNAME ====================

const USERNAME = {
    MIN_LENGTH: 3,
    MAX_LENGTH: 50,
    PATTERN: /^\S+$/,   // គ្មាន space
};

// ==================== ERROR CODES ====================

const ERROR_CODES = {
    // Auth
    INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
    EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
    EMAIL_ALREADY_VERIFIED: "EMAIL_ALREADY_VERIFIED",
    ACCOUNT_DELETED: "ACCOUNT_DELETED",
    ACCOUNT_BLOCKED: "ACCOUNT_BLOCKED",
    ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
    TOKEN_EXPIRED: "TOKEN_EXPIRED",
    INVALID_TOKEN: "INVALID_TOKEN",
    TOKEN_REVOKED: "TOKEN_REVOKED",

    // User
    USER_NOT_FOUND: "USER_NOT_FOUND",
    DUPLICATE: "DUPLICATE",
    VALIDATION_ERROR: "VALIDATION_ERROR",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
};

// ==================== EXPORTS ====================

module.exports = {
    // User defaults
    DEFAULT_AVATAR,
    DEFAULT_BADGE,

    // Roles
    ROLES,
    ROLE_MAP,

    // Status
    USER_STATUS,
    VALID_USER_STATUSES,

    // Gender
    GENDERS,
    VALID_GENDERS,

    // Upload
    UPLOAD_DIRS,
    ALLOWED_MIME,
    ALLOWED_IMAGE_MIME,
    ALLOWED_VIDEO_MIME,
    ALLOWED_EXT,
    MAX_FILE_SIZE,
    MAX_FILES,

    // Pagination
    PAGINATION,

    // Token
    TOKEN_EXPIRY,

    // Validation
    PASSWORD,
    PHONE_PATTERN,
    USERNAME,

    // Errors
    ERROR_CODES,
};