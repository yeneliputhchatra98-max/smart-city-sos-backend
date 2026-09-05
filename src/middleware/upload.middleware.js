const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

// ── Storage engine — organized by type ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const isVideo  = file.mimetype.startsWith('video/');
    const subDir   = isVideo ? 'videos' : 'images';
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', subDir);

    fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const safeName = `${uuidv4()}${ext}`;
    cb(null, safeName);
  },
});

// ── File filter ───────────────────────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// ── Multer instance — max 10 files, 20 MB each ───────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  20 * 1024 * 1024,   // 20 MB
    files:     10,
  },
});

module.exports = { upload };
