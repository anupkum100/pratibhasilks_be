const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");

const generateOrderNo = () => {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);

  return `PS-${y}${m}${d}-${random}`;
};

const validateOrderPayload = ({ buyer, items }) => {
  if (!buyer?.name?.trim() || !buyer?.phone?.trim()) {
    return "Buyer name and phone are required";
  }

  if (!Array.isArray(items) || items.length === 0) {
    return "At least one product is required";
  }

  const invalidItem = items.find((item) => {
    return (
      !mongoose.Types.ObjectId.isValid(item.productId) ||
      !Number.isFinite(Number(item.soldPrice)) ||
      Number(item.soldPrice) < 0
    );
  });

  if (invalidItem) {
    return "Each order item must include a valid product and sold price";
  }

  return "";
};

const createOrder = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { buyer, items, comments } = req.body;
    const validationMessage = validateOrderPayload({
      buyer,
      items,
    });

    if (validationMessage) {
      return res.status(400).json({
        message: validationMessage,
      });
    }

    const productIds = items
      .map((item) => String(item.productId || ""))
      .filter(Boolean);
    const uniqueProductIds = new Set(productIds);

    if (
      productIds.length !== items.length ||
      uniqueProductIds.size !== productIds.length
    ) {
      return res.status(400).json({
        message: "Each product can be sold only once in the same order",
      });
    }

    let createdOrder;

    await session.withTransaction(async () => {
      const products = await Product.find({
        _id: { $in: productIds },
      }).session(session);

      if (products.length !== productIds.length) {
        throw new Error("One or more products were not found");
      }

      const unavailableProduct = products.find(
        (product) =>
          Number(product.stock) <= 0 ||
          Number(product.reservedStock || 0) > 0 ||
          product.order ||
          product.soldOrder
      );

      if (unavailableProduct) {
        throw new Error(
          `${unavailableProduct.name} is already sold`
        );
      }

      const orderItems = products.map((product) => {
        const incomingItem = items.find(
          (item) => String(item.productId) === String(product._id)
        );

        return {
          product: product._id,
          sku: product.sku,
          name: product.name,
          listedPrice: Number(product.offerPrice || product.price || 0),
          soldPrice: Number(incomingItem.soldPrice || 0),
        };
      });

      const totalListedPrice = orderItems.reduce(
        (total, item) => total + Number(item.listedPrice || 0),
        0
      );

      const totalSoldPrice = orderItems.reduce(
        (total, item) => total + Number(item.soldPrice || 0),
        0
      );

      const order = await Order.create(
        [
          {
            orderNo: generateOrderNo(),
            buyer: {
              name: buyer.name.trim(),
              phone: buyer.phone.trim(),
            },
            items: orderItems,
            totalListedPrice,
            totalSoldPrice,
            comments: comments || "",
            soldBy: req.user?._id,
          },
        ],
        { session }
      );

      createdOrder = order[0];

      for (const product of products) {
        const claimedProduct = await Product.findOneAndUpdate(
          {
            _id: product._id,
            stock: { $gt: 0 },
            order: null,
            $and: [
              {
                $or: [
                  { reservedStock: 0 },
                  { reservedStock: { $exists: false } },
                ],
              },
              {
                $or: [
                  { soldOrder: null },
                  { soldOrder: { $exists: false } },
                ],
              },
            ],
          },
          {
            $set: {
              stock: 0,
              order: createdOrder._id,
            },
          },
          {
            new: true,
            session,
          }
        );

        if (!claimedProduct) {
          throw new Error(`${product.name} is already sold or reserved`);
        }
      }
    });

    return res.status(201).json({
      message: "Order created successfully",
      order: createdOrder,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Failed to create order",
    });
  } finally {
    session.endSession();
  }
};

const getOrders = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.max(Number(req.query.limit || 50), 1);
    const skip = (page - 1) * limit;

    const search = req.query.search?.trim() || "";
    const status = req.query.status || "all";

    const query = {};

    if (status !== "all") {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { orderNo: { $regex: search, $options: "i" } },
        { orderSku: { $regex: search, $options: "i" } },
        { "buyer.name": { $regex: search, $options: "i" } },
        { "buyer.phone": { $regex: search, $options: "i" } },
        { "items.sku": { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
      ];
    }

    const [orders, totalOrders] = await Promise.all([
      Order.find(query)
        .populate("soldBy", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Order.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        page,
        limit,
        totalOrders,
        totalPages: Math.ceil(totalOrders / limit),
        hasMore: skip + orders.length < totalOrders,
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
    });
  }
};

module.exports = {
  createOrder,
  getOrders
};
