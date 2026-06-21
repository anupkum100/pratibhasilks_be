const express = require("express");

const authMiddleware = require("../middleware/auth");
const upload = require("../middleware/upload");


const {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductFilters,
} = require("../controllers/productController");

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
router.post("/", upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "otherImages", maxCount: 10 },
]),
  createProduct);

router.put("/:id", upload.fields([
  { name: "mainImage", maxCount: 1 },
  { name: "otherImages", maxCount: 10 },
]),
  updateProduct);

router.delete("/:id", deleteProduct);

module.exports = router;