require("dotenv").config();

const mongoose = require("mongoose");
const { app } = require("./app");
const {
  startReservationCleanupJob,
  stopReservationCleanupJob,
} = require("./jobs/reservationCleanupJob");

const PORT = process.env.PORT || 4000;

let server;
let shuttingDown = false;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected");

    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startReservationCleanupJob();
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${PORT} is already in use.`);
      } else {
        console.error("Server error:", error);
      }

      process.exit(1);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
}

async function shutdown(signal) {
  if (shuttingDown) return;

  shuttingDown = true;

  console.log(`${signal} received. Shutting down...`);

  stopReservationCleanupJob();

  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }

  await mongoose.connection.close();

  console.log("Server stopped");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startServer();