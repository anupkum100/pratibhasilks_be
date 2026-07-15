const Payment = require("../models/Payment");

const allowedSortFields = new Set([
    "type",
    "category",
    "paymentType",
    "amount",
    "quantity",
    "source",
    "date",
    "paidVia",
    "createdAt",
]);

const sanitizePaymentPayload = (body) => ({
    type: String(body.type || "").trim(),
    paymentType: String(body.paymentType || "Miscellaneous").trim() || "Miscellaneous",
    category: String(body.category || "Expense").trim() || "Expense",
    amount: Number(body.amount || 0),
    quantity: Number(body.quantity || 1),
    source: String(body.source || "").trim(),
    paidVia: String(body.paidVia || "").trim(),
    date: body.date || null,
    comment: String(body.comment || "").trim(),
});

const validatePaymentPayload = (payload) => {
    if (!Number.isFinite(payload.amount) || payload.amount < 0) {
        return "Payment amount must be a valid non-negative number.";
    }

    if (!Number.isFinite(payload.quantity) || payload.quantity < 1) {
        return "Quantity must be at least 1.";
    }

    if (payload.date && Number.isNaN(new Date(payload.date).getTime())) {
        return "Payment date is invalid.";
    }

    return "";
};

const paginationNumber = (value, fallback, min, max) => {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(Math.max(parsed, min), max);
};

const escapeRegex = (value = "") => {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

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
        const safePage = paginationNumber(page, 1, 1, 10_000);
        const safeLimit = paginationNumber(limit, 8, 1, 100);
        const safeSortBy = allowedSortFields.has(sortBy) ? sortBy : "date";
        const safeSortOrder = sortOrder === "asc" ? "asc" : "desc";

        if (category !== "All") {
            query.category = category;
        }

        const safeSearch = escapeRegex(search.trim());

        if (safeSearch) {
            query.$or = [
                { type: { $regex: safeSearch, $options: "i" } },
                { paymentType: { $regex: safeSearch, $options: "i" } },
                { source: { $regex: safeSearch, $options: "i" } },
                { paidVia: { $regex: safeSearch, $options: "i" } },
                { comment: { $regex: safeSearch, $options: "i" } },
            ];
        }

        const skip = (safePage - 1) * safeLimit;

        const sort = {
            [safeSortBy]: safeSortOrder === "asc" ? 1 : -1,
        };

        const [payments, total, summary] = await Promise.all([
            Payment.find(query).sort(sort).skip(skip).limit(safeLimit),
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
                page: safePage,
                limit: safeLimit,
                total,
                totalPages: Math.ceil(total / safeLimit),
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
        const payload = sanitizePaymentPayload(req.body);
        const validationMessage = validatePaymentPayload(payload);

        if (validationMessage) {
            return res.status(400).json({
                error: true,
                message: validationMessage,
            });
        }

        const payment = await Payment.create(payload);

        res.status(201).json({
            error: false,
            data: payment,
            message: "Payment created",
        });
    } catch (error) {
        res.status(500).json({
            error: true,
            message: error.message || "Failed to create payment",
        });
    }
};

const updatePayment = async (req, res) => {
    try {
        const payload = sanitizePaymentPayload(req.body);
        const validationMessage = validatePaymentPayload(payload);

        if (validationMessage) {
            return res.status(400).json({
                error: true,
                message: validationMessage,
            });
        }

        const payment = await Payment.findByIdAndUpdate(
            req.params.id,
            payload,
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
    } catch (error) {
        res.status(error.name === "CastError" ? 400 : 500).json({
            error: true,
            message: error.name === "CastError"
                ? "Invalid payment ID"
                : error.message || "Failed to update payment",
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
        res.status(error.name === "CastError" ? 400 : 500).json({
            error: true,
            message: error.name === "CastError"
                ? "Invalid payment ID"
                : "Failed to delete payment",
        });
    }
};

module.exports = {
    getPayments,
    createPayment,
    updatePayment,
    deletePayment
};
