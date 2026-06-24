const express = require("express");
const {
    getPayments,
    createPayment,
    updatePayment,
    deletePayment,
} = require("../controllers/paymentController");

const { protect, adminOnly } = require("../middleware/auth");


const router = express.Router();

router.get("/", protect, adminOnly, getPayments);
router.post("/", protect, adminOnly, createPayment);
router.put("/:id", protect, adminOnly, updatePayment);
router.delete("/:id", protect, adminOnly, deletePayment);

module.exports = router;