const Order = require("../models/PublicOrder");

const {
    sendBuyerOrderEmail,
    sendAdminOrderEmail,
} = require("./emailService");

const {
    sendAdminOrderWhatsapp,
} = require("./whatsappService");

const NOTIFICATION_PATHS = {
    buyerEmail: "notifications.buyerEmail",
    adminEmail: "notifications.adminEmail",
    adminWhatsapp: "notifications.adminWhatsapp",
};

function getNestedNotification(order, notificationName) {
    return order.notifications?.[notificationName] || {};
}

async function claimNotification(
    orderId,
    notificationName
) {
    const path = NOTIFICATION_PATHS[notificationName];

    if (!path) {
        throw new Error(
            `Unknown notification type: ${notificationName}`
        );
    }

    /*
     * Atomically claim the notification.
     * Only one request can change PENDING/FAILED to PROCESSING.
     */
    const claimedOrder = await Order.findOneAndUpdate(
        {
            _id: orderId,

            $or: [
                {
                    [`${path}.status`]: {
                        $in: ["PENDING", "FAILED"],
                    },
                },
                {
                    [`${path}.status`]: {
                        $exists: false,
                    },
                },
            ],
        },
        {
            $set: {
                [`${path}.status`]: "PROCESSING",
                [`${path}.lastAttemptAt`]: new Date(),
                [`${path}.error`]: null,
            },
        },
        {
            new: true,
        }
    ).lean();

    return claimedOrder;
}

async function markNotificationSent(
    orderId,
    notificationName,
    providerMessageId
) {
    const path = NOTIFICATION_PATHS[notificationName];

    await Order.updateOne(
        {
            _id: orderId,
            [`${path}.status`]: "PROCESSING",
        },
        {
            $set: {
                [`${path}.status`]: "SENT",
                [`${path}.sentAt`]: new Date(),
                [`${path}.providerMessageId`]:
                    providerMessageId || null,
                [`${path}.error`]: null,
            },
        }
    );
}

async function markNotificationFailed(
    orderId,
    notificationName,
    error
) {
    const path = NOTIFICATION_PATHS[notificationName];

    await Order.updateOne(
        {
            _id: orderId,
            [`${path}.status`]: "PROCESSING",
        },
        {
            $set: {
                [`${path}.status`]: "FAILED",
                [`${path}.error`]: String(
                    error?.message || error || "Unknown notification error"
                ).slice(0, 1000),
            },
        }
    );
}

async function markNotificationSkipped(
    orderId,
    notificationName,
    reason
) {
    const path = NOTIFICATION_PATHS[notificationName];

    await Order.updateOne(
        {
            _id: orderId,
        },
        {
            $set: {
                [`${path}.status`]: "SKIPPED",
                [`${path}.lastAttemptAt`]: new Date(),
                [`${path}.error`]: reason || null,
            },
        }
    );
}

async function processNotification({
    order,
    notificationName,
    sender,
    shouldSkip,
    skipReason,
}) {
    const currentState = getNestedNotification(
        order,
        notificationName
    );

    if (
        currentState.status === "SENT" ||
        currentState.status === "SKIPPED"
    ) {
        return currentState.status.toLowerCase();
    }

    if (shouldSkip) {
        await markNotificationSkipped(
            order._id,
            notificationName,
            skipReason
        );

        return "skipped";
    }

    const claimedOrder = await claimNotification(
        order._id,
        notificationName
    );

    /*
     * No document means another request already claimed or sent it.
     */
    if (!claimedOrder) {
        return "already_processing_or_sent";
    }

    try {
        const result = await sender(claimedOrder);

        if (result?.skipped) {
            await markNotificationSkipped(
                order._id,
                notificationName,
                result.reason
            );

            return "skipped";
        }

        await markNotificationSent(
            order._id,
            notificationName,
            result?.providerMessageId
        );

        return "sent";
    } catch (error) {
        await markNotificationFailed(
            order._id,
            notificationName,
            error
        );

        console.error(
            `[Order Notification] ${notificationName} failed`,
            {
                orderNumber: order.orderNumber,
                orderId: String(order._id),
                error: error?.message || error,
            }
        );

        return "failed";
    }
}

async function sendOrderNotifications(orderInput) {
    const order =
        orderInput?.toObject?.() ||
        orderInput;

    if (!order?._id) {
        throw new Error(
            "A saved order is required for notifications."
        );
    }

    const customer =
        order.customer ||
        order.buyer ||
        {};

    const buyerEmail = String(
        customer.email ||
        ""
    ).trim();

    const notificationConfigs = [
        {
            notificationName: "buyerEmail",
            sender: sendBuyerOrderEmail,
            shouldSkip: !buyerEmail,
            skipReason: "Buyer email was not provided.",
        },
        {
            notificationName: "adminEmail",
            sender: sendAdminOrderEmail,
            shouldSkip: false,
        },
        {
            notificationName: "adminWhatsapp",
            sender: sendAdminOrderWhatsapp,
            shouldSkip: false,
        },
    ];

    const tasks = notificationConfigs.map(
        ({
            notificationName,
            sender,
            shouldSkip,
            skipReason,
        }) =>
            processNotification({
                order,
                notificationName,
                sender,
                shouldSkip,
                skipReason,
            })
    );

    const settledResults =
        await Promise.allSettled(tasks);

    return settledResults.reduce(
        (summary, result, index) => {
            const notificationName =
                notificationConfigs[index]
                    .notificationName;

            summary[notificationName] =
                result.status === "fulfilled"
                    ? result.value
                    : "failed";

            if (result.status === "rejected") {
                console.error(
                    `[Order Notification] Unexpected ${notificationName} failure`,
                    {
                        orderNumber:
                            order.orderNumber,
                        error:
                            result.reason?.message ||
                            result.reason,
                    }
                );
            }

            return summary;
        },
        {}
    );
}

module.exports = {
    sendOrderNotifications,
};