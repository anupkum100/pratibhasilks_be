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
       * verification and webhook may both confirm the same payment.
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

      const reservationWasReleased =
        fresh.orderStatus === "CANCELLED" ||
        (
          fresh.reservationExpiresAt &&
          fresh.reservationExpiresAt.getTime() <= Date.now()
        );

      /*
       * Payment succeeded after cancellation or reservation expiry.
       *
       * The old reservation no longer exists, so attempt to claim
       * currently available stock atomically.
       */
      if (reservationWasReleased) {
        const claimedProducts = [];

        for (const item of fresh.items) {
          const quantity = Number(item.quantity || 1);

          const product = await Product.findOneAndUpdate(
            {
              _id: item.productId,
              stock: { $gte: quantity },
              $or: [
                { soldOrder: { $exists: false } },
                { soldOrder: null },
              ],
            },
            {
              $inc: {
                stock: -quantity,
              },
              $set: {
                soldOrder: fresh._id,
                reservedStock: 0,
                reservationExpiresAt: null,
              },
              $unset: {
                reservedOrder: "",
              },
            },
            {
              new: true,
              session,
            }
          );

          if (!product) {
            /*
             * Throwing here rolls back any products already claimed
             * earlier in this transaction.
             */
            const error = new Error(
              `${item.sku} is no longer available. Payment requires refund or manual review.`
            );

            error.statusCode = 409;
            error.code = "PAID_PRODUCT_UNAVAILABLE";
            throw error;
          }

          claimedProducts.push(product);
        }

        fresh.paymentStatus = "PAID";
        fresh.orderStatus = "CONFIRMED";
        fresh.razorpayPaymentId = paymentId;
        fresh.razorpaySignature = signature;
        fresh.reservationExpiresAt = null;
        fresh.paymentFailureReason = undefined;

        savedOrder = await fresh.save({ session });
        return;
      }

      /*
       * Normal successful-payment flow:
       * convert the existing reservation into a completed sale.
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
            error.code = "RESERVATION_MISSING";
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

    savedOrder.$locals = savedOrder.$locals || {};
    savedOrder.$locals.alreadyProcessed = alreadyProcessed;

    return savedOrder;
  } finally {
    await session.endSession();
  }
}

module.exports = { verifyCheckoutSignature, confirmPaidOrder }
