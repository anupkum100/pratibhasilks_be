require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const serverless = require("serverless-http");

const connectDB = require("./db");

const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const orderRoutes = require("./routes/orderRoutes");

const app = express();

app.use(helmet());
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options(/.*/, cors());

app.use(express.json({ limit: "1mb" }));

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("Database connection error:", error);

    return res.status(500).json({
      success: false,
      message: "Database connection failed"
    });
  }
});

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Saree Ecommerce Backend API is running"
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy"
  });
});

app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

module.exports.handler = serverless(app);
module.exports.app = app;
