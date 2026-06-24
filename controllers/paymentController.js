const Payment = require("../models/Payment");

const getPayments = async (req, res) => {
    try {
        const {
            search = "",
            category = "All",
            sortBy = "date",
            sortOrder = "desc",
            page = 1,
            limit = 8,
        } = req.query;

        const query = {};

        if (category !== "All") {
            query.category = category;
        }

        if (search.trim()) {
            query.$or = [
                { paymentType: { $regex: search, $options: "i" } },
                { source: { $regex: search, $options: "i" } },
                { paidVia: { $regex: search, $options: "i" } },
                { comment: { $regex: search, $options: "i" } },
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const sort = {
            [sortBy]: sortOrder === "asc" ? 1 : -1,
        };

        const [payments, total, summary] = await Promise.all([
            Payment.find(query).sort(sort).skip(skip).limit(Number(limit)),
            Payment.countDocuments(query),
            Payment.aggregate([
                {
                    $group: {
                        _id: "$category",
                        total: { $sum: "$amount" },
                        count: { $sum: 1 },
                    },
                },
            ]),
        ]);

        const inventorySpend =
            summary.find((x) => x._id === "Inventory")?.total || 0;

        const expenseSpend =
            summary.find((x) => x._id === "Expense")?.total || 0;

        res.json({
            error: false,
            data: payments,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / Number(limit)),
            },
            summary: {
                totalSpend: inventorySpend + expenseSpend,
                inventorySpend,
                expenseSpend,
                transactions: total,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: true,
            message: "Failed to fetch payments",
        });
    }
};

const createPayment = async (req, res) => {
    try {
        const payment = await Payment.create(req.body);

        res.status(201).json({
            error: false,
            data: payment,
            message: "Payment created",
        });
    } catch {
        res.status(500).json({
            error: true,
            message: "Failed to create payment",
        });
    }
};

const updatePayment = async (req, res) => {
    try {
        const payment = await Payment.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!payment) {
            return res.status(404).json({
                error: true,
                message: "Payment not found",
            });
        }

        res.json({
            error: false,
            data: payment,
            message: "Payment updated",
        });
    } catch {
        res.status(500).json({
            error: true,
            message: "Failed to update payment",
        });
    }
};

const deletePayment = async (req, res) => {
    try {
        const payment = await Payment.findByIdAndDelete(req.params.id);

        if (!payment) {
            return res.status(404).json({
                error: true,
                message: "Payment not found",
            });
        }

        res.json({
            error: false,
            message: "Payment deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            error: true,
            message: "Failed to delete payment",
        });
    }
};

module.exports = {
    getPayments,
    createPayment,
    updatePayment,
    deletePayment
};