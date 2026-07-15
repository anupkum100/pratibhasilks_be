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

async function reserveProducts({
  items,
  expiresAt
}) {
  const reservedProducts = [];

  try {
    for (const item of items) {
      const reservedProduct = await reserveSingleProduct({
        sku: item.sku,
        quantity: item.quantity,
        expiresAt
      });

      if (!reservedProduct) {
        await rollbackReservations(reservedProducts);
        return null;
      }

      reservedProducts.push(reservedProduct);
    }

    return reservedProducts;
  } catch (error) {
    await rollbackReservations(reservedProducts);
    throw error;
  }
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
