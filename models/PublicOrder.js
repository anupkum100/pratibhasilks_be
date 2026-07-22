const mongoose = require("mongoose");

const addressSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    addressLine1: {
      type: String,
      required: true,
      trim: true,
    },

    addressLine2: {
      type: String,
      trim: true,
    },

    landmark: {
      type: String,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    state: {
      type: String,
      required: true,
      trim: true,
    },

    pincode: {
      type: String,
      required: true,
      trim: true,
    },

    addressSource: {
      type: String,
      enum: ["PINCODE_API", "MANUAL"],
      default: "PINCODE_API",
    },
  },
  {
    _id: false,
  }
);

const itemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    mainImageId: {
      type: String,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      max: 1,
    },

    listedPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

/*
 * Tracks the delivery status of each order notification.
 *
 * PENDING:
 * Notification has not been attempted.
 *
 * PROCESSING:
 * A backend request has claimed the notification and is sending it.
 *
 * SENT:
 * Notification was successfully sent.
 *
 * FAILED:
 * Sending failed and may be retried.
 *
 * SKIPPED:
 * Notification was intentionally skipped, such as when the buyer
 * did not provide an email address.
 */
const notificationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: [
        "PENDING",
        "PROCESSING",
        "SENT",
        "FAILED",
        "SKIPPED",
      ],
      default: "PENDING",
    },

    sentAt: {
      type: Date,
      default: null,
    },

    lastAttemptAt: {
      type: Date,
      default: null,
    },

    providerMessageId: {
      type: String,
      trim: true,
      default: null,
    },

    error: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    _id: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
      index: true,
      trim: true,
    },

    publicAccessToken: {
      type: String,
      unique: true,
      required: true,
      index: true,
      trim: true,
    },

    checkoutAttemptId: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },

    orderType: {
      type: String,
      enum: ["BUY_NOW", "CART", "ADMIN"],
      default: "BUY_NOW",
    },

    customer: {
      name: {
        type: String,
        required: true,
        trim: true,
      },

      phone: {
        type: String,
        required: true,
        trim: true,
        index: true,
      },

      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
    },

    shippingAddress: {
      type: addressSchema,
      required: true,
    },

    items: {
      type: [itemSchema],
      required: true,
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "At least one order item is required.",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    shippingCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paymentMethod: {
      type: String,
      enum: ["ONLINE", "COD"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: [
        "PENDING",
        "PAID",
        "FAILED",
        "REFUNDED",
      ],
      default: "PENDING",
      index: true,
    },

    orderStatus: {
      type: String,
      enum: [
        "PAYMENT_PENDING",
        "CONFIRMED",
        "PROCESSING",
        "PACKED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED",
        "PAYMENT_RECEIVED_AFTER_EXPIRY",
      ],
      default: "PAYMENT_PENDING",
      index: true,
    },

    razorpayOrderId: {
      type: String,
      trim: true,
    },

    razorpayPaymentId: {
      type: String,
      trim: true,
    },

    razorpaySignature: {
      type: String,
      trim: true,
    },

    paymentFailureReason: {
      type: String,
      trim: true,
    },

    reservationExpiresAt: {
      type: Date,
      index: true,
    },

    customerNotes: {
      type: String,
      trim: true,
    },

    source: {
      type: String,
      enum: [
        "WEBSITE",
        "INSTAGRAM",
        "WHATSAPP",
        "ADMIN",
      ],
      default: "WEBSITE",
    },

    tracking: {
      courierName: {
        type: String,
        trim: true,
      },

      trackingNumber: {
        type: String,
        trim: true,
      },

      trackingUrl: {
        type: String,
        trim: true,
      },
    },

    /*
     * Notification delivery tracking.
     *
     * These fields help prevent duplicate messages when:
     * - verify-payment is retried
     * - Razorpay callbacks are repeated
     * - the webhook and frontend verification both process the order
     */
    notifications: {
      buyerEmail: {
        type: notificationSchema,
        default: () => ({
          status: "PENDING",
        }),
      },

      adminEmail: {
        type: notificationSchema,
        default: () => ({
          status: "PENDING",
        }),
      },

      adminWhatsapp: {
        type: notificationSchema,
        default: () => ({
          status: "PENDING",
        }),
      },
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index(
  {
    razorpayOrderId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      razorpayOrderId: {
        $type: "string",
        $gt: "",
      },
    },
  }
);

orderSchema.index(
  {
    razorpayPaymentId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      razorpayPaymentId: {
        $type: "string",
        $gt: "",
      },
    },
  }
);

module.exports = mongoose.model(
  "PublicOrder",
  orderSchema
);