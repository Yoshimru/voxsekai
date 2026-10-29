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

const audioTypes = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/flac": ".flac",
  "audio/x-flac": ".flac",
};

const extensionMap = { ...imageTypes, ...audioTypes };
const maxImageSize = 6 * 1024 * 1024;
const maxAudioSize = 30 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDirectory),
  filename: (req, file, callback) => {
    const extension =
      extensionMap[file.mimetype] ||
      path.extname(file.originalname).toLowerCase() ||
      ".bin";
    const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`;
    callback(null, name);
  },
});

function removeFile(file) {
  if (file?.path) fs.unlink(file.path, () => {});
}

const upload = multer({
  storage,
  limits: { fileSize: maxAudioSize },
  fileFilter(req, file, callback) {
    if (file.fieldname === "audioFile") {
      if (!audioTypes[file.mimetype]) {
        req.audioUploadError =
          "Неподдерживаемый аудиоформат. Загрузите MP3, WAV, OGG, M4A, FLAC или WEBM.";
        return callback(null, false);
      }
      return callback(null, true);
    }
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
    if (req.file && req.file.size > maxImageSize) {
      removeFile(req.file);
      req.file = undefined;
      req.imageUploadError = "Картинка слишком большая. Максимум — 6 МБ.";
    }
    next();
  });
}

/** Принимает и картинку, и аудио в одной форме трека. */
function uploadTrackMedia(req, res, next) {
  upload.fields([
    { name: "imageFile", maxCount: 1 },
    { name: "audioFile", maxCount: 1 },
  ])(req, res, (error) => {
    req.imageFile = req.files?.imageFile?.[0] || null;
    req.audioFile = req.files?.audioFile?.[0] || null;

    if (error) {
      req.mediaUploadError =
        error.code === "LIMIT_FILE_SIZE"
          ? "Аудиофайл слишком большой. Максимум — 30 МБ."
          : "Не удалось загрузить файл. Попробуйте другой.";
      removeFile(req.imageFile);
      removeFile(req.audioFile);
      req.imageFile = null;
      req.audioFile = null;
      return next();
    }

    if (req.imageFile && req.imageFile.size > maxImageSize) {
      removeFile(req.imageFile);
      req.imageFile = null;
      req.mediaUploadError = "Картинка слишком большая. Максимум — 6 МБ.";
    }
    if (req.audioUploadError && req.audioFile) {
      removeFile(req.audioFile);
      req.audioFile = null;
    }
    next();
  });
}

/** Файл важнее ссылки; при удалении галочкой картинка очищается. */
function resolveImageUrl(req, currentImage = "") {
  const imageFile = req.imageFile || req.file;
  if (imageFile) {
    return `/assets/uploads/${path.basename(imageFile.filename)}`;
  }
  if (req.body?.removeImage === "on") return "";
  const provided = String(req.body?.imageUrl || "").trim();
  if (provided && /^(https?:\/\/|\/(?!\/))/i.test(provided)) {
    return provided;
  }
  return currentImage || "";
}

/** Аудиофайл имеет приоритет над ссылкой. */
function resolveAudioUrl(req, currentAudio = "") {
  if (req.audioFile) {
    return `/assets/uploads/${path.basename(req.audioFile.filename)}`;
  }
  const provided = String(req.body?.audioUrl || "").trim();
  if (provided && /^(https?:\/\/|\/(?!\/))/i.test(provided)) {
    return provided;
  }
  return currentAudio || "";
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
  uploadTrackMedia,
  resolveImageUrl,
  resolveAudioUrl,
  cleanupImage,
  uploadDirectory,
};
