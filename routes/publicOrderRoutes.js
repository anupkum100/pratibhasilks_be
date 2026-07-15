const express = require("express");
const { getPublicOrder, getAllOrders } = require("../controllers/publicOrderController");
const { protect, adminOnly } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();
const publicOrderRateLimit = rateLimit({
  windowMs: 60_000,
  max: 120,
  message: "Too many order lookup requests. Please try again shortly.",
});

router.get("/:orderNumber", publicOrderRateLimit, getPublicOrder);

router.get("/", protect, adminOnly, getAllOrders);

module.exports = router;
