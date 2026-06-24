const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        paymentType: {
            type: String,
            enum: [
                "Inventory",
                "Packaging",
                "Logistics",
                "Marketing",
                "Technology",
                "Office",
                "Miscellaneous",
            ],
            default: "Miscellaneous",
        },
        category: {
            type: String,
            enum: ["Expense", "Inventory"],
            default: "Expense",
        },
        amount: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
        source: { type: String, trim: true },
        paidVia: { type: String, trim: true },
        date: Date,
        comment: String,
    },
    { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);