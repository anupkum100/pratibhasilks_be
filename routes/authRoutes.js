const express = require("express");
const { googleLogin, getMe } = require("../controllers/authController");
const { protect } = require("../middleware/auth");
const rateLimit = require("../middleware/rateLimit");

const router = express.Router();
const authRateLimit = rateLimit({
  windowMs: 60_000,
  max: 20,
  message: "Too many login attempts. Please try again shortly.",
});

router.post("/google", authRateLimit, googleLogin);
router.get("/me", protect, getMe);

module.exports = router;
