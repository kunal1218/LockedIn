import fs from "fs";
import path from "path";
import multer from "multer";

export const MAX_MARKETPLACE_IMAGES = 5;
export const MARKETPLACE_UPLOAD_ROOT = path.resolve(
  __dirname,
  "../../public/uploads/marketplace"
);

const ensureUploadDir = () => {
  fs.mkdirSync(MARKETPLACE_UPLOAD_ROOT, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, MARKETPLACE_UPLOAD_ROOT);
  },
  filename: (req, file, cb) => {
    const listingId = String(
      (req.params as { id?: string; listingId?: string }).id ??
        (req.params as { listingId?: string }).listingId ??
        "listing"
    ).replace(/[^a-zA-Z0-9_-]/g, "");
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    cb(null, `${listingId}-${timestamp}-${safeName}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const allowed = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/jpg",
  ]);
  if (allowed.has(file.mimetype)) {
    cb(null, true);
    return;
  }
  cb(new Error("Only .jpg, .jpeg, .png, .webp images are allowed"));
};

export const marketplaceImageUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: MAX_MARKETPLACE_IMAGES,
  },
  fileFilter,
});
