const crypto = require("crypto");
const PublicOrder = require("../models/PublicOrder");
const WebhookEvent = require("../models/WebhookEvent");
const { confirmPaidOrder } = require("../services/paymentService");

const WEBHOOK_PROVIDER = "RAZORPAY";
const PROCESSING_STALE_MS = 5 * 60 * 1000;

const verifyWebhookSignature = ({ raw, signature }) => {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    throw new Error("Razorpay webhook secret is not configured.");
  }

  if (!raw?.length || !signature) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(raw)
    .digest("hex");

  return (
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  );
};

const getEventId = (req, event) =>
  req.get("x-razorpay-event-id") ||
  [
    event.event,
    event.created_at,
    event.payload?.payment?.entity?.id ||
      event.payload?.order?.entity?.id ||
      "na",
  ].join(":");

const reserveWebhookEvent = async ({ eventId, eventType }) => {
  const existing = await WebhookEvent.findOne({
    provider: WEBHOOK_PROVIDER,
    eventId,
  });

  if (existing?.status === "PROCESSED") {
    return { skip: true, reason: "duplicate" };
  }

  if (
    existing?.status === "PROCESSING" &&
    existing.updatedAt &&
    Date.now() - new Date(existing.updatedAt).getTime() < PROCESSING_STALE_MS
  ) {
    return { skip: true, reason: "processing" };
  }

  try {
    const eventRecord = await WebhookEvent.findOneAndUpdate(
      {
        provider: WEBHOOK_PROVIDER,
        eventId,
        $or: [
          { status: "FAILED" },
          { status: "PROCESSING", updatedAt: { $lte: new Date(Date.now() - PROCESSING_STALE_MS) } },
          { status: { $exists: false } },
        ],
      },
      {
        $set: {
          eventType,
          status: "PROCESSING",
          processingStartedAt: new Date(),
          lastError: "",
        },
        $setOnInsert: {
          provider: WEBHOOK_PROVIDER,
          eventId,
        },
      },
      {
        new: true,
        upsert: true,
      }
    );

    return { eventRecord };
  } catch (error) {
    if (error?.code === 11000) {
      return { skip: true, reason: "processing" };
    }

    throw error;
  }
};

const markWebhookProcessed = (eventRecord) =>
  WebhookEvent.updateOne(
    { _id: eventRecord._id },
    {
      $set: {
        status: "PROCESSED",
        processedAt: new Date(),
        lastError: "",
      },
    }
  );

const markWebhookFailed = (eventRecord, error) =>
  WebhookEvent.updateOne(
    { _id: eventRecord._id },
    {
      $set: {
        status: "FAILED",
        lastError: error?.message || "Webhook processing failed.",
      },
    }
  );

const processWebhookEvent = async (event) => {
  if (["payment.captured", "order.paid"].includes(event.event)) {
    const payment = event.payload?.payment?.entity;
    const orderId = payment?.order_id || event.payload?.order?.entity?.id;

    if (!orderId) {
      throw new Error("Razorpay order ID missing in webhook payload.");
    }

    const order = await PublicOrder.findOne({ razorpayOrderId: orderId });

    if (!order) {
      throw new Error("Order not found for Razorpay webhook.");
    }

    await confirmPaidOrder({
      order,
      paymentId: payment?.id || order.razorpayPaymentId,
      signature: "WEBHOOK_VERIFIED",
      allowExpiredPayment: true,
    });
  }

  if (event.event === "payment.failed") {
    const payment = event.payload?.payment?.entity;

    if (!payment?.order_id) {
      throw new Error("Razorpay order ID missing in failed payment webhook.");
    }

    await PublicOrder.findOneAndUpdate(
      {
        razorpayOrderId: payment.order_id,
        paymentStatus: { $ne: "PAID" },
        orderStatus: "PAYMENT_PENDING",
      },
      {
        $set: {
          paymentFailureReason:
            payment.error_description ||
            payment.error_reason ||
            "Payment failed",
        },
      }
    );
  }
};

async function razorpayWebhook(req, res) {
  let eventRecord = null;

  try {
    const raw = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(req.rawBody || "");
    const signature = req.get("x-razorpay-signature") || "";

    if (!verifyWebhookSignature({ raw, signature })) {
      return res.status(400).json({
        message: "Invalid webhook signature.",
      });
    }

    const event = JSON.parse(raw.toString("utf8"));
    const eventId = getEventId(req, event);
    const reservation = await reserveWebhookEvent({
      eventId,
      eventType: event.event,
    });

    if (reservation.skip) {
      return res.json({
        received: true,
        duplicate: reservation.reason === "duplicate",
        processing: reservation.reason === "processing",
      });
    }

    eventRecord = reservation.eventRecord;
    await processWebhookEvent(event);
    await markWebhookProcessed(eventRecord);

    return res.json({
      received: true,
    });
  } catch (error) {
    if (eventRecord) {
      await markWebhookFailed(eventRecord, error).catch((markError) => {
        console.error("Failed to mark webhook event failed:", markError);
      });
    }

    return res.status(500).json({
      message: error.message || "Webhook processing failed.",
    });
  }
}

module.exports = razorpayWebhook;
