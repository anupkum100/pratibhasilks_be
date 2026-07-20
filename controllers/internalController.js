const releaseExpiredReservations = require("../jobs/releaseExpiredReservations")

async function releaseExpired(req, res) {
  try {
    const released = await releaseExpiredReservations();

    return res.status(200).json({
      message: "Expired reservations processed successfully.",
      released,
    });
  } catch (error) {
    console.error("Release expired orders failed:", error);

    return res.status(500).json({
      message: "Failed to release expired reservations.",
    });
  }
}

module.exports = releaseExpired
