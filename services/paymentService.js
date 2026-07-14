const mongoose = require("mongoose");
const crypto = require("crypto");
const PublicOrder = require("../models/PublicOrder");
const { finalizeReservation } = require("./inventoryService");


function verifyCheckoutSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function confirmPaidOrder({ order, paymentId, signature }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const fresh = await PublicOrder.findById(order._id).session(session);
      if (!fresh || fresh.paymentStatus === "PAID") return;
      if (fresh.orderStatus === "CANCELLED") {
        fresh.paymentStatus = "PAID";
        fresh.orderStatus = "PAYMENT_RECEIVED_AFTER_EXPIRY";
        fresh.razorpayPaymentId = paymentId;
        await fresh.save({ session });
        return;
      }
      for (const item of fresh.items) {
        const product = await finalizeReservation(item, fresh._id, session);
        if (!product) throw new Error(`Reservation missing for ${item.sku}`);
      }
      fresh.paymentStatus = "PAID";
      fresh.orderStatus = "CONFIRMED";
      fresh.razorpayPaymentId = paymentId;
      fresh.razorpaySignature = signature;
      fresh.reservationExpiresAt = null;
      await fresh.save({ session });
    });
  } finally {
    await session.endSession();
  }
}

module.exports = { verifyCheckoutSignature, confirmPaidOrder }
