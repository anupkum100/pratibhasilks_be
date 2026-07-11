const Product = require("../models/Product")

async function reserveSingleProduct({ sku, expiresAt }) {
  return Product.findOneAndUpdate(
    { sku, stock: { $gte: 1 } },
    { $inc: { stock: -1, reservedStock: 1 }, $set: { reservationExpiresAt: expiresAt } },
    { new: true }
  );
}

async function finalizeReservation(item, orderId, session) {
  return Product.findOneAndUpdate(
    { _id: item.productId, reservedStock: { $gte: item.quantity } },
    { $inc: { reservedStock: -item.quantity }, $set: { reservationExpiresAt: null, soldOrder: orderId } },
    { new: true, session }
  );
}

async function releaseReservation(item, session) {
  return Product.findOneAndUpdate(
    { _id: item.productId, reservedStock: { $gte: item.quantity } },
    { $inc: { stock: item.quantity, reservedStock: -item.quantity }, $set: { reservationExpiresAt: null } },
    { new: true, session }
  );
}

module.exports = { reserveSingleProduct, finalizeReservation, releaseReservation }