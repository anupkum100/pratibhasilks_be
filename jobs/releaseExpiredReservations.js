const mongoose = require("mongoose");
const PublicOrder = require("../models/PublicOrder")
const { releaseReservation } = require("../services/inventoryService")

async function releaseExpiredReservations() {
  const orders = await PublicOrder.find({ paymentStatus: "PENDING", orderStatus: "PAYMENT_PENDING", reservationExpiresAt: { $lte: new Date() } });
  let released = 0;
  for (const order of orders) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const fresh = await PublicOrder.findOne({ _id: order._id, paymentStatus: "PENDING", orderStatus: "PAYMENT_PENDING" }).session(session);
        if (!fresh) return;
        for (const item of fresh.items) await releaseReservation(item, session);
        fresh.orderStatus = "CANCELLED";
        fresh.paymentFailureReason = "Payment reservation expired";
        fresh.reservationExpiresAt = null;
        await fresh.save({ session });
        released += 1;
      });
    } finally { await session.endSession(); }
  }
  return released;
}

module.exports = releaseExpiredReservations
