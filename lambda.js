require("dotenv").config();

const serverless = require("serverless-http");
const { app } = require("./app");
const releaseExpiredReservations = require("./jobs/releaseExpiredReservations");

let cachedHandler;

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    /*
     * EventBridge Scheduler invocation.
     *
     * Configure EventBridge to send:
     * {
     *   "source": "pratibha.checkout.reservation-cleanup"
     * }
     */
    if (event?.source === "pratibha.checkout.reservation-cleanup") {
        try {
            const released = await releaseExpiredReservations();

            console.log("Expired reservation cleanup completed", {
                released,
                executedAt: new Date().toISOString(),
            });

            return {
                success: true,
                released,
            };
        } catch (error) {
            console.error("Expired reservation cleanup failed", {
                message: error.message,
                stack: error.stack,
            });

            throw error;
        }
    }

    /*
     * Normal API Gateway invocation.
     */
    if (event.rawPath?.startsWith("/default/")) {
        event.rawPath = event.rawPath.replace("/default", "");
    }

    if (event.path?.startsWith("/default/")) {
        event.path = event.path.replace("/default", "");
    }

    if (event.requestContext?.http?.path?.startsWith("/default/")) {
        event.requestContext.http.path =
            event.requestContext.http.path.replace("/default", "");
    }

    if (!cachedHandler) {
        cachedHandler = serverless(app);
    }

    return cachedHandler(event, context);
};