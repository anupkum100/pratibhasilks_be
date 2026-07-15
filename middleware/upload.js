const multer = require("multer");

const storage = multer.memoryStorage();
const allowedImageTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
]);

const fileFilter = (req, file, cb) => {
    if (!allowedImageTypes.has(file.mimetype)) {
        return cb(new Error("Only image files are allowed."));
    }

    return cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
});

module.exports = upload;
