const Product = require("../models/Product")

async function reserveSingleProduct({
  sku,
  quantity = 1,
  expiresAt
}) {
  return Product.findOneAndUpdate(
    {
      sku,
      stock: {
        $gte: quantity
      }
    },
    {
      $inc: {
        stock: -quantity,
        reservedStock: quantity
      },
      $set: {
        reservationExpiresAt: expiresAt
      }
    },
    {
      new: true,
      runValidators: true
    }
  );
}

async function finalizeReservation(item, orderId, session) {
  return Product.findOneAndUpdate(
    { _id: item.productId, reservedStock: { $gte: item.quantity } },
    { $inc: { reservedStock: -item.quantity }, $set: { reservationExpiresAt: null, soldOrder: orderId } },
    { new: true, session }
  );
}

async function releaseReservation({ productId, quantity = 1, session }) {
  return Product.findOneAndUpdate(
    { _id: productId, reservedStock: { $gte: quantity } },
    {
      $inc: { stock: quantity, reservedStock: -quantity },
      $set: { reservationExpiresAt: null },
    },
    { new: true, session }
  );
}

module.exports = { reserveSingleProduct, finalizeReservation, releaseReservation }