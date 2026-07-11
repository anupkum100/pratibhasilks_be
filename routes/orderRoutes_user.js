const express = require("express");
const { getPublicOrder } = require("../controllers/orderController_user");

const router = express.Router();

router.get("/:orderNumber", getPublicOrder);

module.exports = router;
