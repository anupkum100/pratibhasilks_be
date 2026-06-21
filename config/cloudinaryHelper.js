const streamifier = require("streamifier");
const cloudinary = require("./cloudinary");

function uploadBufferToCloudinary(fileBuffer, folder = "pratibha-silks") {
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