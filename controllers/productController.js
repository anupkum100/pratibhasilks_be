const cloudinary = require("../config/cloudinary");
const { uploadBufferToCloudinary } = require("../config/cloudinaryHelper");
const { validationError } = require("../config/validationHelper");
const Order = require("../models/Order");
const Product = require("../models/Product");
const PublicOrder = require("../models/PublicOrder");

const createProduct = async (req, res) => {
  const uploadedImageIds = [];

  try {
    const body = req.body;

    let mainImageId = body.mainImageId || "";
    let otherImageIds = parseArray(body.otherImageIds);

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

    if (req.files?.mainImage?.[0]) {
      const uploadedMain = await uploadBufferToCloudinary(
        req.files.mainImage[0].buffer
      );

      mainImageId = uploadedMain.public_id;
      uploadedImageIds.push(uploadedMain.public_id);
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
      uploadedImageIds.push(
        ...uploadedOthers.map((img) => img.public_id)
      );
    }

    const product = await Product.create({
      sku: body.sku?.trim(),
      name: body.name,
      description: body.description || "",
      price: Number(body.price || 0),
      offerPrice: normalizeOfferPrice(body.offerPrice),
      mainImageId,
      otherImageIds,
      stock: parseStock(body.stock),
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
    await cleanupUploadedImages(uploadedImageIds);

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
  const uploadedImageIds = [];

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
    const isProtectedProduct = await hasOrderReferences(existingProduct);

    if (
      isProtectedProduct &&
      hasRestrictedProductChanges({
        body,
        files: req.files,
        removedImageIds,
        existingProduct,
        nextOtherImageIds: otherImageIds,
      })
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This product is linked to an order or reservation. SKU, price, stock and images cannot be changed.",
      });
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

    if (req.files?.mainImage?.[0]) {
      if (existingProduct.mainImageId) {
        removedImageIds.push(existingProduct.mainImageId);
      }

      const uploadedMain = await uploadBufferToCloudinary(
        req.files.mainImage[0].buffer
      );

      mainImageId = uploadedMain.public_id;
      uploadedImageIds.push(uploadedMain.public_id);
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
      uploadedImageIds.push(
        ...uploadedOthers.map((img) => img.public_id)
      );
    }

    const product = await Product.findByIdAndUpdate(
      id,
      {
        sku: body.sku?.trim(),
        name: body.name,
        description: body.description || "",
        price: Number(body.price || 0),
        offerPrice: normalizeOfferPrice(body.offerPrice),
        mainImageId,
        otherImageIds,
        stock: parseStock(body.stock),
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
    await cleanupUploadedImages(uploadedImageIds);

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
    const existingProduct = await Product.findById(id);

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        message: "Product not found"
      });
    }

    if (await hasOrderReferences(existingProduct)) {
      return res.status(409).json({
        success: false,
        message:
          "This product is linked to an order or reservation and cannot be deleted.",
      });
    }

    await Product.findByIdAndDelete(id);

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
    const page = clampPositiveInteger(req.query.page, 1, 1, 10_000);
    const limit = clampPositiveInteger(req.query.limit, 100, 1, 100);
    const skip = (page - 1) * limit;

    const fabrics = parseArray(req.query.fabrics);
    const occasions = parseArray(req.query.occasions);
    const categories = parseArray(req.query.categories);
    const colors = parseArray(req.query.colors);
    const sort = req.query.sort || "latest";
    const search = String(req.query.search || "").trim();

    const hideOutOfStock = req.query.hideOutOfStock !== "false";

    const query = {};

    if (hideOutOfStock) {
      query.stock = { $gt: 0 };
    }

    if (fabrics.length) query.fabric = { $in: fabrics };
    if (colors.length) query.color = { $in: colors };
    if (categories.length) query.categories = { $in: categories };
    if (occasions.length) query.occasions = { $in: occasions };

    if (search) {
      const searchRegex = new RegExp(escapeRegExp(search), "i");

      query.$or = [
        { sku: searchRegex },
        { name: searchRegex },
        { description: searchRegex },
        { fabric: searchRegex },
        { color: searchRegex },
        { categories: searchRegex },
        { occasions: searchRegex },
      ];
    }

    const sortOption =
      sort === "price_low_high"
        ? { effectivePrice: 1, createdAt: -1 }
        : sort === "price_high_low"
          ? { effectivePrice: -1, createdAt: -1 }
          : { createdAt: -1 };

    const productProjection = {
      sku: 1,
      name: 1,
      price: 1,
      offerPrice: 1,
      mainImageId: 1,
      stock: 1,
      fabric: 1,
      color: 1,
      colorHex: 1,
      categories: 1,
      occasions: 1,
      blouseIncluded: 1,
      description: 1,
      additionalInformation: 1,
      otherImageIds: 1,
    };

    const [products, totalProducts] = await Promise.all([
      Product.aggregate([
        { $match: query },
        {
          $addFields: {
            effectivePrice: {
              $cond: [{ $gt: ["$offerPrice", 0] }, "$offerPrice", "$price"],
            },
          },
        },
        { $sort: sortOption },
        { $skip: skip },
        { $limit: limit },
        { $project: productProjection },
      ]),

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
    const [
      fabrics,
      categories,
      occasions,
      colors,
    ] = await Promise.all([
      Product.distinct("fabric", { fabric: { $nin: [null, ""] } }),
      Product.distinct("categories", { categories: { $nin: [null, ""] } }),
      Product.distinct("occasions", { occasions: { $nin: [null, ""] } }),
      Product.aggregate([
        {
          $match: {
            color: {
              $nin: [null, ""],
            },
          },
        },
        {
          $group: {
            _id: "$color",
            hex: {
              $first: "$colorHex",
            },
          },
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            hex: {
              $ifNull: ["$hex", "#cccccc"],
            },
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        fabrics: fabrics.filter(Boolean),
        occasions: occasions.filter(Boolean),
        categories: categories.filter(Boolean),
        colors,
      },
    });
  } catch (error) {
    console.error("Get product filters error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product filters",
    });
  }
};

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

async function hasOrderReferences(product) {
  if (
    product.order ||
    product.soldOrder ||
    Number(product.reservedStock || 0) > 0
  ) {
    return true;
  }

  const [adminOrder, publicOrder] = await Promise.all([
    Order.exists({
      "items.product": product._id,
    }),
    PublicOrder.exists({
      "items.productId": product._id,
    }),
  ]);

  return Boolean(adminOrder || publicOrder);
}

function hasRestrictedProductChanges({
  body,
  files,
  removedImageIds,
  existingProduct,
  nextOtherImageIds,
}) {
  const restrictedComparisons = [
    ["sku", body.sku?.trim(), existingProduct.sku, "sku" in body],
    [
      "price",
      Number(body.price || 0),
      Number(existingProduct.price || 0),
      "price" in body,
    ],
    [
      "offerPrice",
      normalizeOfferPrice(body.offerPrice),
      normalizeOfferPrice(existingProduct.offerPrice),
      "offerPrice" in body,
    ],
    [
      "stock",
      parseStock(body.stock),
      Number(existingProduct.stock || 0),
      "stock" in body,
    ],
    [
      "mainImageId",
      body.mainImageId || existingProduct.mainImageId || "",
      existingProduct.mainImageId || "",
      "mainImageId" in body,
    ],
  ];

  const hasRestrictedFieldChange = restrictedComparisons.some(
    ([, nextValue, currentValue, wasProvided]) =>
      wasProvided && String(nextValue) !== String(currentValue)
  );

  const currentOtherImageIds = parseArray(existingProduct.otherImageIds);
  const hasOtherImageChange =
    JSON.stringify(nextOtherImageIds) !== JSON.stringify(currentOtherImageIds);

  return (
    hasRestrictedFieldChange ||
    hasOtherImageChange ||
    removedImageIds.length > 0 ||
    Boolean(files?.mainImage?.[0]) ||
    Boolean(files?.otherImages?.length)
  );
}

async function cleanupUploadedImages(imageIds) {
  if (!imageIds.length) return;

  await Promise.all(
    [...new Set(imageIds)].map((imageId) =>
      cloudinary.uploader.destroy(imageId).catch((error) => {
        console.error("Cloudinary cleanup failed:", error);
      })
    )
  );
}

function normalizeOfferPrice(value) {
  const offerPrice = Number(value || 0);
  return Number.isFinite(offerPrice) && offerPrice > 0 ? offerPrice : null;
}

function parseStock(value) {
  const stock = Number(value);
  return Number.isFinite(stock) ? stock : 1;
}

function clampPositiveInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductFilters
};
