const releaseExpiredReservations = require("../jobs/releaseExpiredReservations")

async function releaseExpired(req, res) {
  try {
    if (req.get("x-internal-secret") !== process.env.INTERNAL_JOB_SECRET) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const released = await releaseExpiredReservations();

    return res.json({
      success: true,
      released
    });
  } catch (error) {
    console.error("Release expired reservations error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to release expired reservations."
    });
  }
}

module.exports = releaseExpired
