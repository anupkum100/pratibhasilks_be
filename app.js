require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const serverless = require("serverless-http");

const connectDB = require("./db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");
const paymentRoutes = require("./routes/paymentRoutes");

// User checkout and payment gateway
const checkoutRoutes = require("./routes/checkoutRoutes");
const publicOrderRoutes = require("./routes/publicOrderRoutes");
const internalRoutes = require("./routes/internalRoutes");
const razorpayWebhook = require("./controllers/webhookController");


const app = express();

const allowedCorsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const isProduction = process.env.NODE_ENV === "production";

const corsOptions = {
  origin: allowedCorsOrigins.length
    ? (origin, callback) => {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    }
    : isProduction
      ? false
      : "*",

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS"
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Idempotency-Key",
    "X-Public-Access-Token"
  ],

  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(helmet());

const ensureDatabaseConnection = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error(
      "Database connection error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
};

app.post(
  "/api/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  ensureDatabaseConnection,
  razorpayWebhook
);
app.use(express.json({
  limit: "1mb"
}));

app.use(ensureDatabaseConnection);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message:
      "Saree Ecommerce Backend API is running"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);

app.use("/api/checkout", checkoutRoutes);
app.use("/api/orders/public", publicOrderRoutes);
app.use("/api/internal", internalRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled API error:", error);

  if (res.headersSent) {
    return next(error);
  }

  const statusCode =
    error.status ||
    error.statusCode ||
    (error.name === "MulterError" ? 400 : 500);

  const safeMessage =
    statusCode >= 500
      ? "Internal server error"
      : error.message || "Invalid request";

  return res.status(statusCode).json({
    success: false,
    message: safeMessage,
  });
});

module.exports.handler = serverless(app);
module.exports.app = app;
