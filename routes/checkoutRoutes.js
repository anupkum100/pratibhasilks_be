const express = require("express");
const { createCheckoutOrder, verifyPayment, cancelCheckoutOrder } = require("../controllers/checkoutController");

const router = express.Router();

router.post("/create-order", createCheckoutOrder);
router.post("/verify-payment", verifyPayment);
router.post("/cancel-order", cancelCheckoutOrder);

module.exports = router;