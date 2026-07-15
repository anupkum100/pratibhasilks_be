const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            trim: true,
            default: "",
        },
        paymentType: {
            type: String,
            trim: true,
            default: "Miscellaneous",
        },
        category: {
            type: String,
            trim: true,
            default: "Expense",
        },
        amount: { type: Number, required: true, min: 0 },
        quantity: { type: Number, default: 1, min: 1 },
        source: { type: String, trim: true },
        paidVia: { type: String, trim: true },
        date: Date,
        comment: String,
    },
    { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
