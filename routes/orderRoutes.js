const express = require("express");
const authMiddleware = require("../middleware/auth");
const { createOrder } = require("../controllers/orderController");

const router = express.Router();

router.post("/", authMiddleware, createOrder);

module.exports = router;
