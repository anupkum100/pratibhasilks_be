const Product = require("../models/Product")

async function reserveSingleProduct({
  sku,
  quantity = 1,
  expiresAt,
  session
}) {
  return Product.findOneAndUpdate(
    {
      sku,
      stock: {
        $gte: quantity
      },
      $or: [
        { soldOrder: null },
        { soldOrder: { $exists: false } },
      ],
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
      runValidators: true,
      session
    }
  );
}

async function reserveProducts(checkoutItems, expiresAt) {
  const reservedProducts = [];
  const unavailableItems = [];

  for (const item of checkoutItems) {
    const reservedProduct = await Product.findOneAndUpdate(
      {
        sku: item.sku,
        stock: { $gte: item.quantity },
      },
      {
        $inc: {
          stock: -item.quantity,
          reservedStock: item.quantity,
        },
        $set: {
          reservationExpiresAt: expiresAt,
        },
      },
      {
        new: true,
      }
    );

    if (!reservedProduct) {
      unavailableItems.push({
        sku: item.sku,
        name: item.name,
        productId: item.productId,
      });
      continue;
    }

    reservedProducts.push(reservedProduct);
  }

  return {
    reservedProducts,
    unavailableItems,
  };
}

async function rollbackReservations(products) {
  for (const product of products) {
    await releaseReservation({
      productId: product._id,
      quantity: 1
    }).catch((error) => {
      console.error(
        "Reservation rollback failed:",
        error
      );
    });
  }
}

async function finalizeReservation(item, orderId, session) {
  return Product.findOneAndUpdate(
    {
      _id: item.productId,
      reservedStock: { $gte: item.quantity },
      $or: [
        { soldOrder: null },
        { soldOrder: { $exists: false } },
      ],
    },
    { $inc: { reservedStock: -item.quantity }, $set: { reservationExpiresAt: null, soldOrder: orderId } },
    { new: true, session }
  );
}

async function releaseReservation({ productId, quantity = 1, session }) {
  return Product.findOneAndUpdate(
    {
      _id: productId,
      reservedStock: { $gte: quantity },
      $or: [
        { soldOrder: null },
        { soldOrder: { $exists: false } },
      ],
    },
    {
      $inc: { stock: quantity, reservedStock: -quantity },
      $set: { reservationExpiresAt: null },
    },
    { new: true, session }
  );
}

module.exports = {
  reserveSingleProduct,
  reserveProducts,
  finalizeReservation,
  releaseReservation
}
