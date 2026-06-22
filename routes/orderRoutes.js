const express = require("express");
const { createOrder, getOrders } = require("../controllers/orderController");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.post("/", protect, adminOnly, createOrder);
router.get("/", protect, adminOnly, getOrders);

module.exports = router;