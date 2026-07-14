const PublicOrder = require("../models/PublicOrder");
const razorpay = require("../config/razorpay");
const { checkoutSchema } = require("../validators/checkoutValidator");
const { reserveSingleProduct, releaseReservation } = require("../services/inventoryService");
const { confirmPaidOrder, verifyCheckoutSignature } = require("../services/paymentService");
const { generateOrderNumber, publicToken, sellingPriceOf, shippingChargeFor } = require("../utils/orderUtils");
const Product = require("../models/Product");

async function createCheckoutOrder(req, res) {
  let reservedProduct = null;
  let createdOrder = null;
  let reservationCompleted = false;

  try {
    const input = checkoutSchema.parse(req.body);

    const checkoutAttemptId =
      req.get("X-Idempotency-Key") || undefined;

    /*
     * Return the same checkout for repeated requests using the same
     * idempotency key.
     */
    if (checkoutAttemptId) {
      const existingOrder = await PublicOrder.findOne({
        checkoutAttemptId
      });

      if (existingOrder) {
        return res
          .status(200)
          .json(toCheckoutResponse(existingOrder));
      }
    }

    const quantity = 1;
    const reservationMinutes = Number(
      process.env.RESERVATION_MINUTES || 10
    );

    const expiresAt = new Date(
      Date.now() + reservationMinutes * 60_000
    );

    /*
     * This must internally use a single atomic findOneAndUpdate:
     *
     * filter:
     * {
     *   sku,
     *   stock: { $gte: quantity }
     * }
     *
     * update:
     * {
     *   $inc: {
     *     stock: -quantity,
     *     reservedStock: quantity
     *   }
     * }
     */
    reservedProduct = await reserveSingleProduct({
      sku: input.sku,
      quantity,
      expiresAt
    });

    if (!reservedProduct) {
      return res.status(409).json({
        success: false,
        message:
          "This saree has already been sold or is currently reserved."
      });
    }

    const sellingPrice = sellingPriceOf(reservedProduct);

    if (
      !Number.isFinite(sellingPrice) ||
      sellingPrice <= 0
    ) {
      throw new Error("Invalid product price.");
    }

    const subtotal = sellingPrice * quantity;
    const shippingCharge = shippingChargeFor(subtotal);
    const totalAmount = subtotal + shippingCharge;

    createdOrder = await PublicOrder.create({
      orderNumber: generateOrderNumber(),
      publicAccessToken: publicToken(),
      checkoutAttemptId,

      customer: input.customer,
      shippingAddress: input.shippingAddress,

      items: [
        {
          productId: reservedProduct._id,
          sku: reservedProduct.sku,
          name: reservedProduct.name,
          image: reservedProduct.mainImageId,
          quantity,
          listedPrice: Number(reservedProduct.price),
          sellingPrice
        }
      ],

      subtotal,
      shippingCharge,
      totalAmount,

      paymentMethod: input.paymentMethod,
      paymentStatus: "PENDING",

      orderStatus:
        input.paymentMethod === "COD"
          ? "CONFIRMED"
          : "PAYMENT_PENDING",

      reservationExpiresAt: expiresAt,
      customerNotes: input.customerNotes || ""
    });

    if (input.paymentMethod === "COD") {
      /*
       * Finalize the reserved stock. This should only reduce
       * reservedStock, because stock was already reduced when reserved.
       */
      await confirmPaidOrder({
        order: createdOrder,
        paymentId: "COD",
        signature: "COD"
      });

      reservationCompleted = true;

      createdOrder.paymentStatus = "PENDING";
      createdOrder.orderStatus = "CONFIRMED";
      createdOrder.reservationExpiresAt = null;

      await createdOrder.save();

      return res.status(201).json({
        success: true,
        paymentRequired: false,
        orderNumber: createdOrder.orderNumber,
        publicAccessToken:
          createdOrder.publicAccessToken
      });
    }

    const gatewayOrder =
      await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: createdOrder.orderNumber,

        notes: {
          internalOrderId: String(createdOrder._id),
          sku: input.sku
        }
      });

    if (!gatewayOrder?.id) {
      throw new Error(
        "Razorpay order could not be created."
      );
    }

    createdOrder.razorpayOrderId = gatewayOrder.id;
    await createdOrder.save();

    /*
     * Reservation remains active while the customer completes payment.
     * It will be finalized in verify-payment or released after expiry.
     */
    return res.status(201).json({
      success: true,
      ...toCheckoutResponse(
        createdOrder,
        gatewayOrder
      )
    });
  } catch (error) {
    console.error(
      "Create checkout order error:",
      error.stack || error
    );

    /*
     * Duplicate idempotency keys can happen when two identical
     * requests arrive almost simultaneously.
     */
    if (
      error?.code === 11000 &&
      error?.keyPattern?.checkoutAttemptId
    ) {
      const checkoutAttemptId =
        req.get("X-Idempotency-Key");

      const existingOrder = checkoutAttemptId
        ? await PublicOrder.findOne({
          checkoutAttemptId
        }).catch(() => null)
        : null;

      /*
       * This request may already have reserved stock before discovering
       * the duplicate key, so release this request's reservation.
       */
      if (
        reservedProduct &&
        !reservationCompleted
      ) {
        await releaseReservation({
          productId: reservedProduct._id,
          quantity: 1
        }).catch((releaseError) => {
          console.error(
            "Duplicate request reservation release failed:",
            releaseError
          );
        });
      }

      if (existingOrder) {
        return res
          .status(200)
          .json({
            success: true,
            ...toCheckoutResponse(existingOrder)
          });
      }
    }

    /*
     * Release the reservation even when the internal order was created
     * but Razorpay order creation failed.
     */
    if (
      reservedProduct &&
      !reservationCompleted
    ) {
      await releaseReservation({
        productId: reservedProduct._id,
        quantity: 1
      }).catch((releaseError) => {
        console.error(
          "Reservation release failed:",
          releaseError
        );
      });
    }

    /*
     * Do not leave a PAYMENT_PENDING order active after its reservation
     * has been released.
     */
    if (
      createdOrder &&
      !reservationCompleted
    ) {
      createdOrder.paymentStatus = "FAILED";
      createdOrder.orderStatus = "CANCELLED";
      createdOrder.reservationExpiresAt = null;

      await createdOrder.save().catch(
        (saveError) => {
          console.error(
            "Failed to cancel incomplete order:",
            saveError
          );
        }
      );
    }

    const isValidation =
      error?.name === "ZodError";

    return res
      .status(isValidation ? 400 : 500)
      .json({
        success: false,
        message: isValidation
          ? error.issues?.[0]?.message ||
          "Invalid checkout information."
          : error.message ||
          "Unable to create order."
      });
  }
}

function toCheckoutResponse(
  order,
  gatewayOrder
) {
  return {
    paymentRequired:
      order.paymentMethod === "ONLINE",

    internalOrderId: order._id,
    orderNumber: order.orderNumber,
    publicAccessToken:
      order.publicAccessToken,

    razorpayOrderId:
      gatewayOrder?.id ||
      order.razorpayOrderId,

    razorpayKeyId:
      process.env.RAZORPAY_KEY_ID,

    amount:
      gatewayOrder?.amount ??
      Math.round(
        Number(order.totalAmount) * 100
      ),

    currency:
      gatewayOrder?.currency || "INR",

    customer: order.customer
  };
}

async function cancelCheckoutOrder(req, res) {
  try {
    const {
      internalOrderId,
      publicAccessToken,
    } = req.body;

    if (!internalOrderId || !publicAccessToken) {
      return res.status(400).json({
        success: false,
        message:
          "Order ID and access token are required.",
      });
    }

    const order = await PublicOrder.findOne({
      _id: internalOrderId,
      publicAccessToken,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    /*
     * Never release inventory for a completed payment.
     */
    if (order.paymentStatus === "PAID") {
      return res.status(409).json({
        success: false,
        message:
          "This order has already been paid and cannot be cancelled.",
      });
    }

    /*
     * Make the endpoint idempotent.
     * Repeated cancellation requests should not restore stock twice.
     */
    if (
      order.orderStatus === "CANCELLED"
    ) {
      return res.status(200).json({
        success: true,
        message:
          "The reservation has already been released.",
        orderNumber: order.orderNumber,
      });
    }

    if (
      order.orderStatus !== "PAYMENT_PENDING"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This order is not eligible for reservation cancellation.",
      });
    }

    for (const item of order.items) {
      const releasedProduct =
        await Product.findOneAndUpdate(
          {
            _id: item.productId,

            /*
             * This condition prevents stock from being
             * restored multiple times.
             */
            reservedStock: {
              $gte: item.quantity,
            },

            /*
             * Do not release a product already assigned
             * to a successful sold order.
             */
            $or: [
              { soldOrder: null },
              { soldOrder: { $exists: false } },
            ],
          },
          {
            $inc: {
              stock: item.quantity,
              reservedStock: -item.quantity,
            },

            $set: {
              reservationExpiresAt: null,
            },
          },
          {
            new: true,
          }
        );

      if (!releasedProduct) {
        console.warn(
          `Reservation could not be released for product ${item.productId}`
        );

        return res.status(409).json({
          success: false,
          message:
            "The reservation could not be released because the product state has changed.",
        });
      }
    }

    order.orderStatus = "CANCELLED";
    order.paymentStatus = "FAILED";
    order.reservationExpiresAt = null;

    order.comments = [
      ...(Array.isArray(order.comments)
        ? order.comments
        : []),
      "Customer cancelled the payment reservation.",
    ];

    await order.save();

    return res.status(200).json({
      success: true,
      message:
        "Reservation cancelled successfully.",
      orderNumber: order.orderNumber,
    });
  } catch (error) {
    console.error(
      "Cancel checkout order error:",
      error.stack || error
    );

    if (error?.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID.",
      });
    }

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Unable to cancel the reservation.",
    });
  }
}


async function verifyPayment(req, res) {
  try {
    const { internalOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await PublicOrder.findOne({ _id: internalOrderId, razorpayOrderId: razorpay_order_id });
    if (!order) return res.status(404).json({ message: "Order not found." });
    if (!verifyCheckoutSignature({ razorpayOrderId: razorpay_order_id, razorpayPaymentId: razorpay_payment_id, signature: razorpay_signature })) {
      return res.status(400).json({ message: "Payment verification failed." });
    }
    await confirmPaidOrder({ order, paymentId: razorpay_payment_id, signature: razorpay_signature });
    return res.json({ orderNumber: order.orderNumber, publicAccessToken: order.publicAccessToken });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Payment verification failed." });
  }
}

module.exports = { createCheckoutOrder, verifyPayment, cancelCheckoutOrder };
