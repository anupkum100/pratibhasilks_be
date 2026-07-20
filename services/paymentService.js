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
  allowExpiredPayment = false,
}) {
  const session = await mongoose.startSession();
  let savedOrder = null;
  let alreadyProcessed = false;

  try {
    await session.withTransaction(async () => {
      const fresh = await PublicOrder.findById(order._id).session(session);

      if (!fresh) {
        const error = new Error(
          "Order not found while confirming payment."
        );
        error.statusCode = 404;
        throw error;
      }

      /*
       * Idempotent handling:
       * payment verification or webhook may call this more than once.
       */
      if (fresh.paymentStatus === "PAID") {
        alreadyProcessed = true;

        let shouldSave = false;

        if (!fresh.razorpayPaymentId && paymentId) {
          fresh.razorpayPaymentId = paymentId;
          shouldSave = true;
        }

        if (!fresh.razorpaySignature && signature) {
          fresh.razorpaySignature = signature;
          shouldSave = true;
        }

        savedOrder = shouldSave
          ? await fresh.save({ session })
          : fresh;

        return;
      }

      /*
       * Payment received after reservation cancellation or expiry.
       */
      if (fresh.orderStatus === "CANCELLED") {
        fresh.paymentStatus = "PAID";
        fresh.orderStatus =
          "PAYMENT_RECEIVED_AFTER_EXPIRY";
        fresh.razorpayPaymentId = paymentId;
        fresh.razorpaySignature = signature;
        fresh.reservationExpiresAt = null;
        fresh.paymentFailureReason = allowExpiredPayment
          ? "Payment received after reservation was released."
          : "Payment verification arrived after reservation was released.";

        savedOrder = await fresh.save({ session });
        return;
      }

      /*
       * Finalize reserved inventory only after successful payment.
       */
      for (const item of fresh.items) {
        const product = await finalizeReservation(
          item,
          fresh._id,
          session
        );

        if (!product) {
          const alreadyFinalizedForOrder =
            await Product.findOne({
              _id: item.productId,
              soldOrder: fresh._id,
            }).session(session);

          if (!alreadyFinalizedForOrder) {
            const error = new Error(
              `Reservation missing for ${item.sku}`
            );
            error.statusCode = 409;
            throw error;
          }
        }
      }

      fresh.paymentStatus = "PAID";
      fresh.orderStatus = "CONFIRMED";
      fresh.razorpayPaymentId = paymentId;
      fresh.razorpaySignature = signature;
      fresh.reservationExpiresAt = null;
      fresh.paymentFailureReason = undefined;

      savedOrder = await fresh.save({ session });
    });

    if (!savedOrder?._id) {
      throw new Error(
        "Payment was processed but the saved order could not be returned."
      );
    }

    savedOrder.$locals =
      savedOrder.$locals || {};

    savedOrder.$locals.alreadyProcessed =
      alreadyProcessed;

    return savedOrder;
  } finally {
    await session.endSession();
  }
}

module.exports = { verifyCheckoutSignature, confirmPaidOrder }
