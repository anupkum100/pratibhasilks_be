const Order = require("../models/Order_user");
const razorpay = require("../config/razorpay");
const { checkoutSchema } = require("../validators/checkoutValidator");
const { reserveSingleProduct, releaseReservation } = require("../services/inventoryService");
const { confirmPaidOrder, verifyCheckoutSignature } = require("../services/paymentService");
const { generateOrderNumber, publicToken, sellingPriceOf, shippingChargeFor } = require("../utils/orderUtils");

async function createCheckoutOrder(req, res) {
  let reservedProduct;
  let createdOrder;
  try {
    const input = checkoutSchema.parse(req.body);
    const checkoutAttemptId = req.get("X-Idempotency-Key") || undefined;
    if (checkoutAttemptId) {
      const existing = await Order.findOne({ checkoutAttemptId });
      if (existing) return res.status(200).json(toCheckoutResponse(existing));
    }

    const minutes = Number(process.env.RESERVATION_MINUTES || 10);
    const expiresAt = new Date(Date.now() + minutes * 60_000);
    reservedProduct = await reserveSingleProduct({ sku: input.sku, expiresAt });
    console.log(reservedProduct)
    if (!reservedProduct) return res.status(409).json({ message: "This saree has already been sold or reserved." });

    const sellingPrice = sellingPriceOf(reservedProduct);
    if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) throw new Error("Invalid product price.");
    const subtotal = sellingPrice;
    const shippingCharge = shippingChargeFor(subtotal);

    createdOrder = await Order.create({
      orderNumber: generateOrderNumber(),
      publicAccessToken: publicToken(),
      checkoutAttemptId,
      customer: input.customer,
      shippingAddress: input.shippingAddress,
      items: [{
        productId: reservedProduct._id, sku: reservedProduct.sku, name: reservedProduct.name,
        image: reservedProduct.mainImageId, quantity: 1, listedPrice: Number(reservedProduct.price), sellingPrice,
      }],
      subtotal, shippingCharge, totalAmount: subtotal + shippingCharge,
      paymentMethod: input.paymentMethod,
      paymentStatus: "PENDING",
      orderStatus: input.paymentMethod === "COD" ? "CONFIRMED" : "PAYMENT_PENDING",
      reservationExpiresAt: expiresAt,
      customerNotes: input.customerNotes,
    });

    if (input.paymentMethod === "COD") {
      await confirmPaidOrder({ order: createdOrder, paymentId: "COD", signature: "COD" });
      createdOrder.paymentStatus = "PENDING";
      createdOrder.orderStatus = "CONFIRMED";
      await createdOrder.save();
      return res.status(201).json({ paymentRequired: false, orderNumber: createdOrder.orderNumber, publicAccessToken: createdOrder.publicAccessToken });
    }

    const gatewayOrder = await razorpay.orders.create({
      amount: Math.round(createdOrder.totalAmount * 100), currency: "INR", receipt: createdOrder.orderNumber,
      notes: { internalOrderId: String(createdOrder._id), sku: input.sku },
    });
    createdOrder.razorpayOrderId = gatewayOrder.id;
    await createdOrder.save();
    return res.status(201).json(toCheckoutResponse(createdOrder, gatewayOrder));
  } catch (error) {
    if (reservedProduct && !createdOrder) {
      await releaseReservation({ productId: reservedProduct._id, quantity: 1 }).catch(() => null);
    }
    const isValidation = error?.name === "ZodError";
    return res.status(isValidation ? 400 : 500).json({ message: isValidation ? error.issues[0]?.message : error.message || "Unable to create order." });
  }
}

function toCheckoutResponse(order, gatewayOrder) {
  return {
    paymentRequired: order.paymentMethod === "ONLINE",
    internalOrderId: order._id,
    orderNumber: order.orderNumber,
    publicAccessToken: order.publicAccessToken,
    razorpayOrderId: gatewayOrder?.id || order.razorpayOrderId,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    amount: gatewayOrder?.amount || Math.round(order.totalAmount * 100),
    currency: gatewayOrder?.currency || "INR",
    customer: order.customer,
  };
}

async function verifyPayment(req, res) {
  try {
    const { internalOrderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const order = await Order.findOne({ _id: internalOrderId, razorpayOrderId: razorpay_order_id });
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

module.exports = { createCheckoutOrder, verifyPayment };
