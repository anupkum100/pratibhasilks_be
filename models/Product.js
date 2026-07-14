const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // Unique Product Identifier (PS_1, PS_2, etc.)
    sku: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // Product Details
    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ""
    },

    price: {
      type: Number,
      required: true
    },

    offerPrice: {
      type: Number,
      default: null
    },

    // Images
    mainImageId: {
      type: String
    },

    otherImageIds: {
      type: [String],
      default: []
    },

    // Inventory
    stock: {
      type: Number,
      required: true,
      default: 1,
      min: 0
    },

    // Saree Details
    fabric: {
      type: String,
      required: true
    },

    blouseIncluded: {
      type: Boolean,
      required: true,
      default: true
    },

    // Filters
    categories: {
      type: [String],
      default: []
    },

    color: {
      type: String,
      default: ""
    },

    colorHex: {
      type: String,
      default: ""
    },

    occasions: {
      type: [String],
      default: []
    },

    additionalInformation: {
      type: String,
      default: ""
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },

    reservedStock: {
      type: Number,
      default: 0,
      min: 0,
    },

    reservationExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },

    soldOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PublicOrder",
      default: null,
    },
  },
  {
    timestamps: true
  }
);

productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ createdAt: -1 });
productSchema.index({ fabric: 1 });
productSchema.index({ color: 1 });
productSchema.index({ categories: 1 });
productSchema.index({ occasions: 1 });
productSchema.index({ stock: 1 });

module.exports = mongoose.model("Product", productSchema);