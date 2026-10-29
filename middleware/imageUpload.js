const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const multer = require("multer");

const uploadDirectory = path.join(__dirname, "..", "assets", "uploads");
fs.mkdirSync(uploadDirectory, { recursive: true });

const imageTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDirectory),
  filename: (req, file, callback) => {
    const extension =
      imageTypes[file.mimetype] ||
      path.extname(file.originalname).toLowerCase() ||
      ".img";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
    callback(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!imageTypes[file.mimetype]) {
      req.imageUploadError =
        "Неподдерживаемый формат. Загрузите JPG, PNG, WEBP, GIF или AVIF.";
      return callback(null, false);
    }
    callback(null, true);
  },
});

/** Принимает multipart-форму с полем imageFile, не роняя страницу при ошибке. */
function uploadImage(req, res, next) {
  upload.single("imageFile")(req, res, (error) => {
    if (error) {
      req.imageUploadError =
        error.code === "LIMIT_FILE_SIZE"
          ? "Файл слишком большой. Максимум — 6 МБ."
          : "Не удалось загрузить изображение. Попробуйте другой файл.";
    }
    next();
  });
}

/** Файл важнее ссылки; при удалении галочкой картинка очищается. */
function resolveImageUrl(req, currentImage = "") {
  if (req.file) {
    return `/assets/uploads/${path.basename(req.file.filename)}`;
  }
  if (req.body?.removeImage === "on") return "";
  const provided = String(req.body?.imageUrl || "").trim();
  if (provided && /^(https?:\/\/|\/(?!\/))/i.test(provided)) {
    return provided;
  }
  return currentImage || "";
}

/** Удаляет старый загруженный файл, если он больше не используется. */
function cleanupImage(previousImage, nextImage) {
  if (
    !previousImage ||
    previousImage === nextImage ||
    !previousImage.startsWith("/assets/uploads/")
  ) {
    return;
  }
  const filename = path.basename(previousImage);
  fs.unlink(path.join(uploadDirectory, filename), () => {});
}

module.exports = {
  uploadImage,
  resolveImageUrl,
  cleanupImage,
  uploadDirectory,
};
