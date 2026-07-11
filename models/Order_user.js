const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  addressLine1: { type: String, required: true, trim: true },
  addressLine2: { type: String, trim: true },
  landmark: { type: String, trim: true },
  city: { type: String, required: true, trim: true },
  state: { type: String, required: true, trim: true },
  pincode: { type: String, required: true, trim: true },
}, { _id: false });

const itemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  image: String,
  quantity: { type: Number, required: true, min: 1 },
  listedPrice: { type: Number, required: true },
  sellingPrice: { type: Number, required: true },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, unique: true, required: true, index: true },
  publicAccessToken: { type: String, unique: true, required: true, index: true },
  checkoutAttemptId: { type: String, unique: true, sparse: true, index: true },
  orderType: { type: String, enum: ["BUY_NOW", "CART", "ADMIN"], default: "BUY_NOW" },
  customer: {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true },
  },
  shippingAddress: { type: addressSchema, required: true },
  items: { type: [itemSchema], required: true },
  subtotal: { type: Number, required: true },
  shippingCharge: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalAmount: { type: Number, required: true },
  paymentMethod: { type: String, enum: ["ONLINE", "COD"], required: true },
  paymentStatus: { type: String, enum: ["PENDING", "PAID", "FAILED", "REFUNDED"], default: "PENDING", index: true },
  orderStatus: { type: String, enum: ["PAYMENT_PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "PAYMENT_RECEIVED_AFTER_EXPIRY"], default: "PAYMENT_PENDING", index: true },
  razorpayOrderId: { type: String, index: true },
  razorpayPaymentId: String,
  razorpaySignature: String,
  paymentFailureReason: String,
  reservationExpiresAt: { type: Date, index: true },
  customerNotes: String,
  source: { type: String, enum: ["WEBSITE", "INSTAGRAM", "WHATSAPP", "ADMIN"], default: "WEBSITE" },
  tracking: { courierName: String, trackingNumber: String, trackingUrl: String },
}, { timestamps: true });

module.exports = mongoose.model("Order_user", orderSchema);
