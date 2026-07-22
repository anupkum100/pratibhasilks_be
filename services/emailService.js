const { Resend } = require("resend");

const {
    buildBuyerOrderEmail,
    buildAdminOrderEmail,
} = require("../templates/orderEmailTemplates");

let resendClient;

function getResendClient() {
    if (!process.env.RESEND_API_KEY) {
        throw new Error("RESEND_API_KEY is not configured.");
    }

    if (!resendClient) {
        resendClient = new Resend(process.env.RESEND_API_KEY);
    }

    return resendClient;
}

function getFromAddress() {
    const fromName = "Pratibha Silks";

    const fromAddress = "care@pratibhasilks.com";

    return `${fromName} <${fromAddress}>`;
}

async function sendEmail({
    to,
    subject,
    html,
    text,
    idempotencyKey,
}) {
    if (!to) {
        throw new Error("Email recipient is missing.");
    }

    const resend = getResendClient();

    const { data, error } = await resend.emails.send(
        {
            from: getFromAddress(),
            to: [to],
            subject,
            html,
            text,
            replyTo: "care@pratibhasilks.com",
        },
        {
            idempotencyKey,
        }
    );

    if (error) {
        throw new Error(
            error.message || "Email provider rejected the request."
        );
    }

    return {
        providerMessageId: data?.id || null,
    };
}

async function sendBuyerOrderEmail(order) {
    const customer = order.customer || order.buyer || {};
    const email = String(customer.email || "").trim();

    if (!email) {
        return {
            skipped: true,
            reason: "Buyer email was not provided.",
        };
    }

    const content = buildBuyerOrderEmail(order);

    return sendEmail({
        to: email,
        ...content,
        idempotencyKey: `buyer-order-${order._id}-${order.orderNumber}}`,
    });
}

async function sendAdminOrderEmail(order) {
    const adminEmail = ["care@pratibhasilks.com", "pratibhasilks@gmail.com"];

    const content = buildAdminOrderEmail(order);

    return sendEmail({
        to: adminEmail,
        ...content,
        idempotencyKey: `admin-order-${order._id}-${order.orderNumber}`,
    });
}



module.exports = {
    sendBuyerOrderEmail,
    sendAdminOrderEmail,
};