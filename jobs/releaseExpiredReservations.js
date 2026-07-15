const mongoose = require("mongoose");
const PublicOrder = require("../models/PublicOrder")
const { releaseReservation } = require("../services/inventoryService")

async function releaseExpiredReservations() {
  const orders = await PublicOrder.find({
    paymentStatus: { $in: ["PENDING", "FAILED"] },
    orderStatus: "PAYMENT_PENDING",
    reservationExpiresAt: { $lte: new Date() }
  });
  let released = 0;
  let failed = 0;

  for (const order of orders) {
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        const fresh = await PublicOrder.findOne({
          _id: order._id,
          paymentStatus: { $in: ["PENDING", "FAILED"] },
          orderStatus: "PAYMENT_PENDING"
        }).session(session);
        if (!fresh) return;
        for (const item of fresh.items) {
          const releasedProduct = await releaseReservation({
            productId: item.productId,
            quantity: item.quantity,
            session,
          });

          if (!releasedProduct) {
            throw new Error(
              `Expired reservation could not be released for ${item.sku}`
            );
          }
        }

        fresh.orderStatus = "CANCELLED";
        fresh.paymentStatus = "FAILED";
        fresh.paymentFailureReason = "Payment reservation expired";
        fresh.reservationExpiresAt = null;
        await fresh.save({ session });
        released += 1;
      });
    } catch (error) {
      failed += 1;
      console.error(
        "Expired reservation release failed:",
        {
          orderId: order._id,
          orderNumber: order.orderNumber,
          error: error.message,
        }
      );
    } finally {
      await session.endSession();
    }
  }

  if (failed > 0) {
    console.error(
      "Expired reservation release completed with failures:",
      { released, failed }
    );
  }

  return released;
}

module.exports = releaseExpiredReservations
