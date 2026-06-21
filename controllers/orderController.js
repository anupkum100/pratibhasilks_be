const mongoose = require("mongoose");
const Product = require("../models/Product");
const Order = require("../models/Order");

/**
 * Creates order after validating stock.
 * Uses MongoDB transaction when supported by the Atlas cluster.
 * MongoDB Atlas supports transactions on replica set/sharded clusters.
 */
async function createOrder(req, res) {
  const session = await mongoose.startSession();

  try {
    const { products } = req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Products array is required"
      });
    }

    session.startTransaction();

    let totalAmount = 0;
    const orderProducts = [];

    for (const item of products) {
      const { productId, quantity } = item;

      if (!productId || !quantity || quantity < 1) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: "Each product must have productId and valid quantity"
        });
      }

      const product = await Product.findById(productId).session(session);

      if (!product) {
        await session.abortTransaction();

        return res.status(404).json({
          success: false,
          message: `Product not found: ${productId}`
        });
      }

      if (product.stock < quantity) {
        await session.abortTransaction();

        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${product.stock}, requested: ${quantity}`
        });
      }

      product.stock -= quantity;
      await product.save({ session });

      totalAmount += product.price * quantity;

      orderProducts.push({
        productId: product._id,
        quantity
      });
    }

    const [order] = await Order.create(
      [
        {
          products: orderProducts,
          totalAmount
        }
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order
    });
  } catch (error) {
    await session.abortTransaction();

    console.error("Create order error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  } finally {
    session.endSession();
  }
}

module.exports = { createOrder };
