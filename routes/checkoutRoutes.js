const express = require("express");
const { createCheckoutOrder, verifyPayment, cancelCheckoutOrder } = require("../controllers/checkoutController");
const rateLimit = require("../middleware/rateLimit");
const releaseExpired = require("../controllers/internalController");

const router = express.Router();
const checkoutRateLimit = rateLimit({
    windowMs: 60_000,
    max: 60,
    message: "Too many checkout requests. Please try again shortly.",
});

router.post("/create-order", checkoutRateLimit, createCheckoutOrder);
router.post("/verify-payment", checkoutRateLimit, verifyPayment);
router.post("/cancel-order", checkoutRateLimit, cancelCheckoutOrder);
router.post("/release-expired-orders", releaseExpired);

module.exports = router;
