const multer = require('multer');

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'video/mp4', 'video/quicktime'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB ceiling (videos); images are re-checked per-file in the controller
const MAX_FILES = 10;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: jpg, png, mp4, mov.`));
    }
    cb(null, true);
  },
});

// Wraps multer so upload errors (bad type, too large, too many files) come
// back as a clean 400 JSON response instead of an unhandled exception.
function handleTicketUpload(req, res, next) {
  upload.array('attachments', MAX_FILES)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}

module.exports = { handleTicketUpload, ALLOWED_MIME_TYPES };
