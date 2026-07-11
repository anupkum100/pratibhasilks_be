const releaseExpiredReservations = require("../jobs/releaseExpiredReservations")

async function releaseExpired(req, res) {
  if (req.get("x-internal-secret") !== process.env.INTERNAL_JOB_SECRET) return res.status(401).json({ message: "Unauthorized" });
  const released = await releaseExpiredReservations();
  return res.json({ released });
}

module.exports = releaseExpired

