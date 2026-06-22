const express = require("express");

const upload = require("../middleware/upload");

const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductFilters,
} = require("../controllers/productController");
const { protect, adminOnly } = require("../middleware/auth");

const router = express.Router();

/**
 * PUBLIC ROUTES
 */
router.get("/", getProducts);
router.get("/filters", getProductFilters);
router.get("/:id", getProductById);

/**
 * ADMIN ROUTES
 */
router.post(
  "/",
  protect,
  adminOnly,
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "otherImages", maxCount: 10 },
  ]),
  createProduct
);

router.put(
  "/:id",
  protect,
  adminOnly,
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "otherImages", maxCount: 10 },
  ]),
  updateProduct
);

router.delete("/:id", protect, adminOnly, deleteProduct);

module.exports = router;