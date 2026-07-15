const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
  },
  eventId: {
    type: String,
    required: true,
  },
  eventType: String,
  status: {
    type: String,
    enum: ["PROCESSING", "PROCESSED", "FAILED"],
    default: "PROCESSING",
    index: true,
  },
  processedAt: Date,
  processingStartedAt: Date,
  lastError: String,
}, { timestamps: true });

schema.index({ provider: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model("WebhookEvent", schema);
