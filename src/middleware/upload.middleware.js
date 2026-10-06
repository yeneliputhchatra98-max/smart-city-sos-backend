const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// ✅ Import constants
const {
    DEFAULT_AVATAR,
    ALLOWED_MIME,
    ALLOWED_EXT,
    MAX_FILE_SIZE,
    MAX_FILES,
} = require("../utils/constants");

// ── Sets សម្រាប់ O(1) lookup ─────────────────────────────
const ALLOWED_MIME_SET = new Set(ALLOWED_MIME);
const ALLOWED_EXT_SET = new Set(ALLOWED_EXT);

// ==================== STORAGE ====================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const isVideo = file.mimetype.startsWith("video/");
        const url = (req.originalUrl || req.url || "").toLowerCase();

        // ✅ កំណត់ subfolder
        let subDir = "images";
        if (url.includes("/avatar")) {
            subDir = "avatars";
        } else if (isVideo) {
            subDir = "videos";
        }

        // ✅ __dirname = src/middleware/ → ../uploads = src/uploads/
        const uploadDir = path.join(__dirname, "..", "uploads", subDir);

        fs.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const safeName = `${uuidv4()}${ext}`;
        cb(null, safeName);
    },
});

// ==================== FILE FILTER ====================

const fileFilter = (req, file, cb) => {
    // ✅ Check MIME
    if (!ALLOWED_MIME_SET.has(file.mimetype)) {
        return cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
    }

    // ✅ Check extension (ការពារ spoof)
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT_SET.has(ext)) {
        return cb(new Error(`Unsupported extension: ${ext}`), false);
    }

    cb(null, true);
};

// ==================== MULTER INSTANCE ====================

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
    },
});

// ==================== HELPERS ====================

/**
 * បង្កើត path សម្រាប់រក្សាទុកក្នុង DB
 * @param {Object} file - Multer file object
 * @returns {string|null} - ឧ. "uploads/avatars/uuid.jpg"
 */
const getStoredPath = (file) => {
    if (!file) return null;

    // ✅ យក subDir ពី file.destination ផ្ទាល់
    const relative = path.relative(
        path.join(__dirname, "..", "uploads"),
        file.destination
    );

    return `uploads/${relative}/${file.filename}`;
    // → "uploads/avatars/uuid.jpg"
    // → "uploads/images/uuid.jpg"
    // → "uploads/videos/uuid.mp4"
};

/**
 * លុប file ចាស់ចេញពី disk
 * @param {string} filePath - ឧ. "uploads/avatars/uuid.jpg"
 */
const deleteOldFile = (filePath) => {
    if (!filePath) return;

    // ✅ Skip default avatar ឬ URL ខាងក្រៅ
    if (
        filePath === DEFAULT_AVATAR ||
        filePath.startsWith("http://") ||
        filePath.startsWith("https://")
    ) {
        return;
    }

    // ✅ filePath = "uploads/avatars/uuid.jpg"
    //    fullPath = "src/uploads/avatars/uuid.jpg"
    const fullPath = path.join(__dirname, "..", filePath);

    // ✅ ការពារ path traversal
    const uploadsRoot = path.join(__dirname, "..", "uploads");
    const resolved = path.resolve(fullPath);
    if (!resolved.startsWith(path.resolve(uploadsRoot))) {
        console.warn(`Path traversal attempt: ${filePath}`);
        return;
    }

    // ✅ លុប file
    if (fs.existsSync(resolved)) {
        fs.unlink(resolved, (err) => {
            if (err) console.error(`Failed to delete file: ${err.message}`);
        });
    }
};

/**
 * បង្កើត URL សម្រាប់ file
 * @param {string} filePath - ឧ. "uploads/avatars/uuid.jpg"
 * @returns {string|null} - ឧ. "/uploads/avatars/uuid.jpg"
 */
const getFileUrl = (filePath) => {
    if (!filePath) return null;
    if (filePath.startsWith("http")) return filePath;
    return `/${filePath}`;
};

// ==================== EXPORT ====================

module.exports = {
    upload,
    deleteOldFile,
    getStoredPath,
    getFileUrl,
    ALLOWED_MIME,
    ALLOWED_EXT,
};