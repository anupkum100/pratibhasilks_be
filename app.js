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
const orderRoutes_user = require("./routes/orderRoutes_user");
const internalRoutes = require("./routes/internalRoutes");
const razorpayWebhook = require("./controllers/webhookController");


const app = express();

const corsOptions = {
  origin: "*",

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
    "X-Idempotency-Key"
  ],

  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use(helmet());

app.post("/api/webhooks/razorpay", express.raw({ type: "application/json" }), razorpayWebhook);
app.use(express.json({
  limit: "1mb"
}));

app.use(async (req, res, next) => {
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
});

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
app.use("/api/orders/public", orderRoutes_user);
app.use("/api/internal", internalRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

module.exports.handler = serverless(app);
module.exports.app = app;