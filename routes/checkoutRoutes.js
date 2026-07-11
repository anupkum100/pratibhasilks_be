const express = require("express");
const { createCheckoutOrder, verifyPayment } = require("../controllers/checkoutController");

const router = express.Router();

router.post("/create-order", createCheckoutOrder);
router.post("/verify-payment", verifyPayment);

module.exports = router;