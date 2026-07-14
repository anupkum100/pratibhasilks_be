const crypto = require("crypto");
const PublicOrder = require("../models/PublicOrder");
const WebhookEvent = require("../models/WebhookEvent");
const { confirmPaidOrder } = require("../services/paymentService");

async function razorpayWebhook(req, res) {
  try {
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.rawBody || "");
    const signature = req.get("x-razorpay-signature") || "";
    const expected = crypto.createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest("hex");
    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      return res.status(400).json({ message: "Invalid webhook signature." });
    }
    const event = JSON.parse(raw.toString("utf8"));
    const eventId = req.get("x-razorpay-event-id") || `${event.event}:${event.created_at}:${event.payload?.payment?.entity?.id || "na"}`;
    try { await WebhookEvent.create({ provider: "RAZORPAY", eventId, eventType: event.event, processedAt: new Date() }); }
    catch (error) { if (error?.code === 11000) return res.json({ received: true, duplicate: true }); throw error; }

    if (["payment.captured", "order.paid"].includes(event.event)) {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id || event.payload?.order?.entity?.id;
      const order = await PublicOrder.findOne({ razorpayOrderId: orderId });
      if (order) await confirmPaidOrder({ order, paymentId: payment?.id || order.razorpayPaymentId, signature: "WEBHOOK_VERIFIED" });
    }
    if (event.event === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      await PublicOrder.findOneAndUpdate({ razorpayOrderId: payment?.order_id, paymentStatus: { $ne: "PAID" } }, {
        paymentStatus: "FAILED", paymentFailureReason: payment?.error_description || "Payment failed",
      });
    }
    return res.json({ received: true });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Webhook processing failed." });
  }
}

module.exports = razorpayWebhook
