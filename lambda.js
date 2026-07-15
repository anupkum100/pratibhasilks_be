require("dotenv").config();
const serverless = require("serverless-http");
const { app } = require("./app");

let cachedHandler;

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

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
