const mongoose = require("mongoose");
const schema = new mongoose.Schema({ provider: String, eventId: String, eventType: String, processedAt: Date }, { timestamps: true });
schema.index({ provider: 1, eventId: 1 }, { unique: true });

module.exports = mongoose.model("WebhookEvent", schema);
