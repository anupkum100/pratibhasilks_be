const cloudinary = require("../config/cloudinary");
const { uploadBufferToCloudinary } = require("../config/cloudinaryHelper");
const { validationError } = require("../config/validationHelper");
const Product = require("../models/Product");

const createProduct = async (req, res) => {
  try {
    const body = req.body;

    let mainImageId = body.mainImageId || "";
    let otherImageIds = parseArray(body.otherImageIds);

    if (req.files?.mainImage?.[0]) {
      const uploadedMain = await uploadBufferToCloudinary(
        req.files.mainImage[0].buffer
      );

      mainImageId = uploadedMain.public_id;
    }

    if (req.files?.otherImages?.length) {
      const uploadedOthers = await Promise.all(
        req.files.otherImages.map((file) =>
          uploadBufferToCloudinary(file.buffer)
        )
      );

      otherImageIds = [
        ...otherImageIds,
        ...uploadedOthers.map((img) => img.public_id),
      ];
    }

    const existingSku = await Product.findOne({
      sku: body.sku?.trim(),
    });

    if (existingSku) {
      return res.status(409).json({
        success: false,
        field: "sku",
        message: `SKU '${body.sku}' already exists`,
      });
    }

    const product = await Product.create({
      sku: body.sku?.trim(),
      name: body.name,
      description: body.description || "",
      price: Number(body.price || 0),
      offerPrice: body.offerPrice ? Number(body.offerPrice) : null,
      mainImageId,
      otherImageIds,
      stock: Number(body.stock || 1),
      fabric: body.fabric,
      blouseIncluded: parseBoolean(body.blouseIncluded, true),
      categories: parseArray(body.categories),
      color: body.color || "",
      colorHex: body.colorHex || "",
      occasions: parseArray(body.occasions),
      additionalInformation: body.additionalInformation || "",
    });

    res.status(201).json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Create product error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        field: "sku",
        message: "SKU already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: validationError(error),
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    let mainImageId = body.mainImageId || existingProduct.mainImageId;
    let otherImageIds = parseArray(
      body.otherImageIds || existingProduct.otherImageIds
    );

    const removedImageIds = parseArray(body.removedImageIds);

    if (req.files?.mainImage?.[0]) {
      if (existingProduct.mainImageId) {
        removedImageIds.push(existingProduct.mainImageId);
      }

      const uploadedMain = await uploadBufferToCloudinary(
        req.files.mainImage[0].buffer
      );

      mainImageId = uploadedMain.public_id;
    }

    if (req.files?.otherImages?.length) {
      const uploadedOthers = await Promise.all(
        req.files.otherImages.map((file) =>
          uploadBufferToCloudinary(file.buffer)
        )
      );

      otherImageIds = [
        ...otherImageIds,
        ...uploadedOthers.map((img) => img.public_id),
      ];
    }

    const duplicateSku = await Product.findOne({
      sku: body.sku?.trim(),
      _id: { $ne: id },
    });

    if (duplicateSku) {
      return res.status(409).json({
        success: false,
        field: "sku",
        message: `SKU '${body.sku}' already exists`,
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      {
        sku: body.sku?.trim(),
        name: body.name,
        description: body.description || "",
        price: Number(body.price || 0),
        offerPrice: body.offerPrice ? Number(body.offerPrice) : null,
        mainImageId,
        otherImageIds,
        stock: Number(body.stock || 1),
        fabric: body.fabric,
        blouseIncluded: parseBoolean(body.blouseIncluded, true),
        categories: parseArray(body.categories),
        color: body.color || "",
        colorHex: body.colorHex || "",
        occasions: parseArray(body.occasions),
        additionalInformation: body.additionalInformation || "",
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (removedImageIds.length > 0) {
      await Promise.all(
        [...new Set(removedImageIds)].map((imageId) =>
          cloudinary.uploader.destroy(imageId)
        )
      );
    }

    res.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error("Update product error:", error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        field: "sku",
        message: "SKU already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: validationError(error),
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

async function deleteProduct(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

const getProducts = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.max(Number(req.query.limit || 100), 1);
    const skip = (page - 1) * limit;

    const fabrics = parseArray(req.query.fabrics);
    const occasions = parseArray(req.query.occasions);
    const categories = parseArray(req.query.categories);
    const colors = parseArray(req.query.colors);
    const sort = req.query.sort || "latest";

    const hideOutOfStock = req.query.hideOutOfStock !== "false";

    const query = {};

    if (hideOutOfStock) {
      query.stock = { $gt: 0 };
    }

    if (fabrics.length) query.fabric = { $in: fabrics };
    if (colors.length) query.color = { $in: colors };
    if (categories.length) query.categories = { $in: categories };
    if (occasions.length) query.occasions = { $in: occasions };

    const sortOption =
      sort === "price_low_high"
        ? { offerPrice: 1, price: 1 }
        : sort === "price_high_low"
          ? { offerPrice: -1, price: -1 }
          : { createdAt: -1 };

    const [products, totalProducts] = await Promise.all([
      Product.find(query)
        .select(
          "sku name price offerPrice mainImageId stock fabric color colorHex categories occasions blouseIncluded description additionalInformation"
        )
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean(),

      Product.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        page,
        limit,
        totalProducts,
        totalPages: Math.ceil(totalProducts / limit),
        hasMore: skip + products.length < totalProducts,
      },
    });
  } catch (error) {
    console.error("Get products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

async function getProductById(req, res) {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      sku: id,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get product error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

const getProductFilters = async (req, res) => {
  try {
    const products = await Product.find().select("fabric occasions categories color colorHex");

    const filters = {
      fabrics: [],
      occasions: [],
      categories: [],
      colors: [],
    };

    products.forEach((product) => {
      addUnique(filters.fabrics, product.fabric);

      if (Array.isArray(product.categories)) {
        product.categories.forEach((category) => {
          addUnique(filters.categories, category);
        });
      }

      if (Array.isArray(product.occasions)) {
        product.occasions.forEach((occasion) => {
          addUnique(filters.occasions, occasion);
        });
      }

      if (product.color) {
        const exists = filters.colors.some(
          (item) => item.name === product.color
        );

        if (!exists) {
          filters.colors.push({
            name: product.color,
            hex: product.colorHex || "#cccccc",
          });
        }
      }
    });

    return res.status(200).json({
      success: true,
      data: filters,
    });
  } catch (error) {
    console.error("Get product filters error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product filters",
    });
  }
};

function addUnique(array, value) {
  if (!value) return;

  if (!array.includes(value)) {
    array.push(value);
  }
}

function parseArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function parseBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return value === true || value === "true";
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductFilters
};
