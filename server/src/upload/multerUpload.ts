import path from "node:path";
import multer from "multer";
import { ALLOWED_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "../config.js";
import { ensureTicketUploadDir, generateStoredFilename } from "../upload/storage.js";
import { UnsupportedMediaTypeError } from "../http/errors.js";

const storage = multer.diskStorage({
  destination: async (req, _file, cb) => {
    try {
      const ticketId = Number(req.params.ticketId);
      const dir = await ensureTicketUploadDir(ticketId);
      cb(null, dir);
    } catch (err) {
      cb(err as Error, "");
    }
  },
  filename: (_req, file, cb) => {
    cb(null, generateStoredFilename(file.originalname));
  },
});

// Errors thrown here surface as a plain Error (not a MulterError), so they're
// thrown as our own AppError subclass and map to 415 directly in errorHandler
// (which checks `instanceof AppError` before the MulterError duck-type check).
function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    cb(new UnsupportedMediaTypeError("File type not allowed. Use JPG, PNG, WEBP, or PDF."));
    return;
  }
  cb(null, true);
}

export const uploadAttachment = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 },
  fileFilter,
}).single("file");
