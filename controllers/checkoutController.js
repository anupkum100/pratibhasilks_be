const mongoose = require("mongoose");
const PublicOrder = require("../models/PublicOrder");
const razorpay = require("../config/razorpay");
const { checkoutSchema } = require("../validators/checkoutValidator");
const { releaseReservation, reserveProducts } = require("../services/inventoryService");
const { confirmPaidOrder, verifyCheckoutSignature } = require("../services/paymentService");
const { generateOrderNumber, publicToken, sellingPriceOf, shippingChargeFor } = require("../utils/orderUtils");
const { sendOrderNotifications } = require("../services/orderNotificationService");

const toCheckoutItems = (input) => {
  const items = Array.isArray(input.items) && input.items.length
    ? input.items
    : [{ sku: input.sku, quantity: 1 }];

  return items.map((item) => ({
    sku: item.sku,
    quantity: 1
  }));
};

const checkoutErrorMessage = (
  error,
  fallback = "Unable to create order."
) =>
  error?.error?.description ||
  error?.error?.message ||
  error?.description ||
  error?.message ||
  fallback;

const isReusableCheckoutOrder = (order) =>
  order &&
  order.paymentMethod === "ONLINE" &&
  order.orderStatus === "PAYMENT_PENDING" &&
  order.paymentStatus === "PENDING" &&
  order.reservationExpiresAt &&
  new Date(order.reservationExpiresAt).getTime() > Date.now();

const serviceabilityError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isDeliveryPostOffice = (postOffice) => {
  const deliveryStatus = String(postOffice?.DeliveryStatus || "").trim().toLowerCase();
  return deliveryStatus !== "non-delivery";
};

async function validatePincodeServiceability(shippingAddress) {
  const pincode = shippingAddress?.pincode;
  const addressSource = shippingAddress?.addressSource || "PINCODE_API";

  if (!/^\d{6}$/.test(String(pincode || ""))) {
    throw serviceabilityError("Please enter a valid 6-digit PIN code.");
  }

  try {
    const response = await fetch(
      `https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`
    );

    if (!response.ok) {
      throw serviceabilityError(
        "PIN code lookup is currently unavailable.",
        503
      );
    }

    const result = await response.json();
    const lookupResult = result?.[0];

    if (
      lookupResult?.Status !== "Success" ||
      !Array.isArray(lookupResult?.PostOffice) ||
      lookupResult.PostOffice.length === 0
    ) {
      throw serviceabilityError(
        "No delivery location found for this PIN code."
      );
    }

    const hasDeliveryLocation =
      lookupResult.PostOffice.some(isDeliveryPostOffice);

    if (!hasDeliveryLocation) {
      throw serviceabilityError(
        "This PIN code is not serviceable for delivery."
      );
    }
  } catch (error) {
    if (
      error.statusCode &&
      error.statusCode !== 503
    ) {
      throw error;
    }

    if (addressSource === "MANUAL") {
      return;
    }

    throw serviceabilityError(
      error.message || "PIN code lookup is currently unavailable.",
      error.statusCode || 503
    );
  }
}

const releaseReservedProducts = async (reservedProducts) => {
  for (const product of reservedProducts) {
    await releaseReservation({
      productId: product._id,
      quantity: 1
    }).catch((releaseError) => {
      console.error(
        "Reservation release failed:",
        releaseError
      );
    });
  }
};

async function ensureGatewayOrder(order) {
  if (
    !isReusableCheckoutOrder(order) ||
    order.razorpayOrderId
  ) {
    return null;
  }

  const gatewayOrder = await razorpay.orders.create({
    amount: Math.round(Number(order.totalAmount) * 100),
    currency: "INR",
    receipt: order.orderNumber,
    notes: {
      internalOrderId: String(order._id),
      skus: order.items.map((item) => item.sku).join(",")
    }
  });

  if (!gatewayOrder?.id) {
    throw new Error(
      "Razorpay order could not be created."
    );
  }

  order.razorpayOrderId = gatewayOrder.id;
  await order.save();

  return gatewayOrder;
}

async function createCheckoutOrder(req, res) {
  let reservedProducts = [];
  let createdOrder = null;
  let reservationCompleted = false;

  try {
    const input = checkoutSchema.parse(req.body);

    const checkoutAttemptId = req.get("X-Idempotency-Key") || undefined;

    /*
     * Return the same checkout for repeated requests using the same
     * idempotency key.
     */
    if (checkoutAttemptId) {
      const existingOrder = await PublicOrder.findOne({
        checkoutAttemptId
      });

      if (existingOrder) {
        if (!isReusableCheckoutOrder(existingOrder)) {
          return res.status(409).json({
            success: false,
            message:
              "This checkout attempt is no longer active. Please retry checkout."
          });
        }

        const gatewayOrder = await ensureGatewayOrder(existingOrder);

        return res
          .status(200)
          .json(toCheckoutResponse(existingOrder, gatewayOrder));
      }
    }

    await validatePincodeServiceability(input.shippingAddress);

    const checkoutItems = toCheckoutItems(input);
    const reservationMinutes = Number(
      process.env.RESERVATION_MINUTES || 1
    );

    const expiresAt = new Date(
      Date.now() + reservationMinutes * 60_000
    );

    const {
      reservedProducts,
      unavailableItems,
    } = await reserveProducts(checkoutItems, expiresAt);

    if (unavailableItems.length > 0) {
      // Release products that were reserved successfully during this attempt.
      await Promise.all(
        reservedProducts.map((product) =>
          Product.findOneAndUpdate(
            {
              _id: product._id,
              reservedStock: { $gte: 1 },
            },
            {
              $inc: {
                stock: 1,
                reservedStock: -1,
              },
            }
          )
        )
      );

      return res.status(409).json({
        success: false,
        message:
          "Some sarees have already been sold or are currently reserved.",
        // unavailableItems,
        unavailableSkus: unavailableItems.map((item) => item.sku),
        canRemoveUnavailableItems: true,
      });
    }

    const orderItems = reservedProducts.map((product) => {
      const sellingPrice = sellingPriceOf(product);

      if (
        !Number.isFinite(sellingPrice) ||
        sellingPrice <= 0
      ) {
        throw new Error(`Invalid product price for ${product.sku}.`);
      }

      return {
        productId: product._id,
        sku: product.sku,
        name: product.name,
        image: product.mainImageId,
        quantity: 1,
        listedPrice: Number(product.price),
        sellingPrice
      };
    });

    const subtotal = orderItems.reduce(
      (total, item) => total + (item.sellingPrice * item.quantity),
      0
    );

    const shippingCharge = shippingChargeFor(
      subtotal,
      orderItems.length,
      input.shippingAddress.state
    );
    const totalAmount = subtotal + shippingCharge;

    createdOrder = await PublicOrder.create({
      orderNumber: generateOrderNumber(),
      publicAccessToken: publicToken(),
      checkoutAttemptId,

      customer: input.customer,
      shippingAddress: input.shippingAddress,
      orderType: orderItems.length > 1 ? "CART" : input.orderType || "BUY_NOW",

      items: orderItems,

      subtotal,
      shippingCharge,
      totalAmount,

      paymentMethod: input.paymentMethod,
      paymentStatus: "PENDING",
      orderStatus: "PAYMENT_PENDING",

      reservationExpiresAt: expiresAt,
      customerNotes: input.customerNotes || ""
    });

    const gatewayOrder =
      await razorpay.orders.create({
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        receipt: createdOrder.orderNumber,

        notes: {
          internalOrderId: String(createdOrder._id),
          skus: orderItems.map((item) => item.sku).join(",")
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
        reservedProducts.length > 0 &&
        !reservationCompleted
      ) {
        await releaseReservedProducts(reservedProducts);
      }

      if (existingOrder) {
        if (!isReusableCheckoutOrder(existingOrder)) {
          return res.status(409).json({
            success: false,
            message:
              "This checkout attempt is no longer active. Please retry checkout."
          });
        }

        const gatewayOrder = await ensureGatewayOrder(existingOrder);

        return res
          .status(200)
          .json({
            success: true,
            ...toCheckoutResponse(existingOrder, gatewayOrder)
          });
      }
    }

    /*
     * Release the reservation even when the internal order was created
     * but Razorpay order creation failed.
     */
    if (
      reservedProducts.length > 0 &&
      !reservationCompleted
    ) {
      await releaseReservedProducts(reservedProducts);
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
    const statusCode =
      isValidation ? 400 : error.statusCode || 500;

    return res
      .status(statusCode)
      .json({
        success: false,
        message: isValidation
          ? error.issues?.[0]?.message ||
          "Invalid checkout information."
          : checkoutErrorMessage(error)
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
    reservationExpiresAt:
      order.reservationExpiresAt,

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
  const session = await mongoose.startSession();

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

    let cancelledOrderNumber = "";
    let earlyResponse = null;

    await session.withTransaction(async () => {
      const order = await PublicOrder.findOne({
        _id: internalOrderId,
        publicAccessToken,
      }).session(session);

      if (!order) {
        earlyResponse = {
          status: 404,
          body: {
            success: false,
            message: "Order not found.",
          },
        };
        return;
      }

      /*
       * Never release inventory for a completed payment.
       */
      if (order.paymentStatus === "PAID") {
        earlyResponse = {
          status: 409,
          body: {
            success: false,
            message:
              "This order has already been paid and cannot be cancelled.",
          },
        };
        return;
      }

      /*
       * Make the endpoint idempotent.
       * Repeated cancellation requests should not restore stock twice.
       */
      if (
        order.orderStatus === "CANCELLED"
      ) {
        earlyResponse = {
          status: 200,
          body: {
            success: true,
            message:
              "The reservation has already been released.",
            orderNumber: order.orderNumber,
          },
        };
        return;
      }

      if (
        order.orderStatus !== "PAYMENT_PENDING"
      ) {
        earlyResponse = {
          status: 409,
          body: {
            success: false,
            message:
              "This order is not eligible for reservation cancellation.",
          },
        };
        return;
      }

      for (const item of order.items) {
        const releasedProduct = await releaseReservation({
          productId: item.productId,
          quantity: item.quantity,
          session,
        });

        if (!releasedProduct) {
          throw new Error(
            `Reservation could not be released for ${item.sku}.`
          );
        }
      }

      order.orderStatus = "CANCELLED";
      order.paymentStatus = "FAILED";
      order.reservationExpiresAt = null;
      order.customerNotes = [
        order.customerNotes,
        "Customer cancelled the payment reservation.",
      ].filter(Boolean).join("\n");

      await order.save({ session });
      cancelledOrderNumber = order.orderNumber;
    });

    if (earlyResponse) {
      return res
        .status(earlyResponse.status)
        .json(earlyResponse.body);
    }

    return res.status(200).json({
      success: true,
      message:
        "Reservation cancelled successfully.",
      orderNumber: cancelledOrderNumber,
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
  } finally {
    await session.endSession();
  }
}


async function verifyPayment(req, res) {
  try {
    const {
      internalOrderId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (
      !internalOrderId ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment verification details.",
      });
    }

    const order = await PublicOrder.findOne({
      _id: internalOrderId,
      razorpayOrderId: razorpay_order_id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const isSignatureValid = verifyCheckoutSignature({
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isSignatureValid) {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed.",
      });
    }

    /*
     * Razorpay or the frontend may retry this endpoint.
     * If this exact payment has already been processed,
     * return success without sending notifications again.
     */
    if (
      order.paymentStatus === "PAID" &&
      order.razorpayPaymentId === razorpay_payment_id
    ) {
      return res.status(200).json({
        success: true,
        alreadyProcessed: true,
        orderNumber: order.orderNumber,
        publicAccessToken: order.publicAccessToken,
        notifications: {
          skipped: true,
          reason: "Payment was already processed.",
        },
      });
    }

    /*
     * Prevent a different Razorpay payment from being applied
     * to an order that is already marked as paid.
     */
    if (order.paymentStatus === "PAID") {
      return res.status(409).json({
        success: false,
        message: "This order has already been paid.",
      });
    }

    /*
     * confirmPaidOrder should atomically change the order
     * from unpaid to paid and finalize the reserved stock.
     */
    const paidOrder = await confirmPaidOrder({
      order,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    let notifications;

    try {
      notifications = await sendOrderNotifications(
        paidOrder
      );
    } catch (notificationError) {
      console.error(
        "[Order Notification] Failed after payment confirmation",
        {
          orderNumber: paidOrder.orderNumber,
          error:
            notificationError.stack ||
            notificationError.message ||
            notificationError,
        }
      );

      /*
       * The payment remains successful even when an email,
       * SMS or WhatsApp notification fails.
       */
      notifications = {
        success: false,
        error:
          notificationError.message ||
          "One or more notifications failed.",
      };
    }

    return res.status(200).json({
      success: true,
      alreadyProcessed: false,
      orderNumber: paidOrder.orderNumber,
      publicAccessToken: paidOrder.publicAccessToken,
      notifications,
    });
  } catch (error) {
    console.error(
      "Payment verification error:",
      error.stack || error
    );

    const errorMessage = String(
      error.message || ""
    ).toLowerCase();

    const isConfigurationError =
      errorMessage.includes("configured") ||
      errorMessage.includes("secret");

    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message: isConfigurationError
          ? "Payment verification failed."
          : error.message ||
          "Payment verification failed.",
      });
  }
}

module.exports = { createCheckoutOrder, verifyPayment, cancelCheckoutOrder };
