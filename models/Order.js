const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    sku: {
      type: String,
      required: true,
    },
    name: String,
    listedPrice: Number,
    soldPrice: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNo: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    buyer: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      phone: {
        type: String,
        required: true,
        trim: true,
      },
    },
    items: {
      type: [orderItemSchema],
      validate: {
        validator: (items) => items.length > 0,
        message: "Order must have at least one product",
      },
    },
    totalListedPrice: {
      type: Number,
      default: 0,
    },
    totalSoldPrice: {
      type: Number,
      default: 0,
    },
    comments: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["SOLD", "CANCELLED", "RETURNED"],
      default: "SOLD",
    },
    soldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    soldAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);