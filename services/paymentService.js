const mongoose = require("mongoose");
const crypto = require("crypto");
const PublicOrder = require("../models/PublicOrder");
const Product = require("../models/Product");
const { finalizeReservation } = require("./inventoryService");


function verifyCheckoutSignature({ razorpayOrderId, razorpayPaymentId, signature }) {
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay key secret is not configured.");
  }

  if (!razorpayOrderId || !razorpayPaymentId || !signature) {
    return false;
  }

  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`).digest("hex");
  return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function confirmPaidOrder({
  order,
  paymentId,
  signature,
  allowExpiredPayment = false
}) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const fresh = await PublicOrder.findById(order._id).session(session);
      if (!fresh) return;

      if (fresh.paymentStatus === "PAID") {
        if (!fresh.razorpayPaymentId && paymentId) {
          fresh.razorpayPaymentId = paymentId;
        }

        if (!fresh.razorpaySignature && signature) {
          fresh.razorpaySignature = signature;
        }

        await fresh.save({ session });
        return;
      }

      if (fresh.orderStatus === "CANCELLED") {
        fresh.paymentStatus = "PAID";
        fresh.orderStatus = "PAYMENT_RECEIVED_AFTER_EXPIRY";
        fresh.razorpayPaymentId = paymentId;
        fresh.razorpaySignature = signature;
        fresh.paymentFailureReason = allowExpiredPayment
          ? "Payment received after reservation was released."
          : "Payment verification arrived after reservation was released.";
        await fresh.save({ session });
        return;
      }

      for (const item of fresh.items) {
        const product = await finalizeReservation(item, fresh._id, session);
        const alreadyFinalizedForOrder = !product
          ? await Product.findOne({
            _id: item.productId,
            soldOrder: fresh._id,
          }).session(session)
          : null;

        if (!product && !alreadyFinalizedForOrder) {
          throw new Error(`Reservation missing for ${item.sku}`);
        }
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
