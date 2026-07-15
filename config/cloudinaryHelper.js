const streamifier = require("streamifier");
const cloudinary = require("./cloudinary");

function isSupportedImageBuffer(fileBuffer) {
    if (!Buffer.isBuffer(fileBuffer) || fileBuffer.length < 12) {
        return false;
    }

    const header = fileBuffer.subarray(0, 12);
    const signature = header.toString("hex");
    const ascii = header.toString("ascii");

    return (
        signature.startsWith("ffd8ff") ||
        signature.startsWith("89504e470d0a1a0a") ||
        ascii.startsWith("GIF87a") ||
        ascii.startsWith("GIF89a") ||
        ascii.startsWith("RIFF") && header.subarray(8, 12).toString("ascii") === "WEBP" ||
        header.subarray(4, 12).toString("ascii") === "ftypavif" ||
        header.subarray(4, 12).toString("ascii") === "ftypavis"
    );
}

function uploadBufferToCloudinary(fileBuffer, folder = "pratibha-silks") {
    if (!isSupportedImageBuffer(fileBuffer)) {
        return Promise.reject(new Error("Only valid image files are allowed."));
    }

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
}

module.exports = {
    uploadBufferToCloudinary,
};
