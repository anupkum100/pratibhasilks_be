const express = require("express");
const { getPublicOrder, getAllOrders } = require("../controllers/publicOrderController");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

router.get("/:orderNumber", getPublicOrder);

router.get("/", protect, adminOnly, getAllOrders);

module.exports = router;
