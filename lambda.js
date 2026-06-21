require("dotenv").config();
const serverless = require("serverless-http");
const mongoose = require("mongoose");
const { app } = require("./app");

let cachedHandler;
let cachedConnection;

async function connectDB() {
    if (cachedConnection && mongoose.connection.readyState === 1) {
        return cachedConnection;
    }

    cachedConnection = await mongoose.connect(process.env.MONGODB_URI, {
        bufferCommands: false,
    });

    return cachedConnection;
}

module.exports.handler = async (event, context) => {
    context.callbackWaitsForEmptyEventLoop = false;

    await connectDB();

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