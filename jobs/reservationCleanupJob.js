const releaseExpiredReservations = require("./releaseExpiredReservations");

const CLEANUP_INTERVAL_MS =
    Number(process.env.RESERVATION_CLEANUP_INTERVAL_MS) || 60 * 1000;

let cleanupTimer = null;
let cleanupRunning = false;

async function runReservationCleanup() {
    if (cleanupRunning) {
        console.log("Reservation cleanup already running. Skipping.");
        return;
    }

    cleanupRunning = true;

    try {
        const released = await releaseExpiredReservations();

        console.log("Reservation cleanup completed", {
            released,
            executedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Reservation cleanup failed", {
            message: error.message,
            stack: error.stack,
        });
    } finally {
        cleanupRunning = false;
    }
}

function startReservationCleanupJob() {
    if (cleanupTimer) {
        return cleanupTimer;
    }

    console.log("Starting local reservation cleanup job", {
        intervalMs: CLEANUP_INTERVAL_MS,
    });

    // Run once immediately when the local server starts.
    runReservationCleanup();

    cleanupTimer = setInterval(
        runReservationCleanup,
        CLEANUP_INTERVAL_MS
    );

    return cleanupTimer;
}

function stopReservationCleanupJob() {
    if (!cleanupTimer) {
        return;
    }

    clearInterval(cleanupTimer);
    cleanupTimer = null;

    console.log("Local reservation cleanup job stopped");
}

module.exports = {
    runReservationCleanup,
    startReservationCleanupJob,
    stopReservationCleanupJob,
};