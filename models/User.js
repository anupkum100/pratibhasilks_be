const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            trim: true,
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        googleId: {
            type: String,
            unique: true,
            sparse: true,
        },

        avatar: {
            type: String,
            default: "",
        },

        role: {
            type: String,
            enum: ["admin", "user"],
            default: "user",
        },

        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);