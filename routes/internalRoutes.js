const express = require("express");
const releaseExpired = require("../controllers/internalController");

const router = express.Router();

router.post("/release-expired-orders", releaseExpired);

module.exports = router;
