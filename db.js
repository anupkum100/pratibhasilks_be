require("dotenv").config();
const mongoose = require("mongoose");

let cachedConnection = null;

/**
 * MongoDB connection caching for AWS Lambda.
 * Lambda containers may be reused, so keeping the connection globally
 * prevents creating a fresh MongoDB connection on every invocation.
 */
async function connectDB() {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment variables");
  }

  mongoose.set("strictQuery", true);

  cachedConnection = await mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    bufferCommands: false
  });

  console.log("MongoDB connected");

  return cachedConnection;
}

module.exports = connectDB;
