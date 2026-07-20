function normalizeIndianPhone(phone) {
    const digits = String(phone || "").replace(/\D/g, "");

    if (digits.length === 10) {
        return `91${digits}`;
    }

    if (digits.length === 12 && digits.startsWith("91")) {
        return digits;
    }

    throw new Error("Invalid Indian WhatsApp phone number.");
}

async function sendWhatsAppTemplate({
    phone,
    templateName,
    languageCode = "en",
    components = [],
}) {
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const apiVersion = process.env.WHATSAPP_API_VERSION || "v23.0";

    if (!accessToken || !phoneNumberId) {
        throw new Error("WhatsApp configuration is missing.");
    }

    const recipient = normalizeIndianPhone(phone);

    const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: recipient,
                type: "template",
                template: {
                    name: templateName,
                    language: {
                        code: languageCode,
                    },
                    components,
                },
            }),
        }
    );

    const result = await response.json();

    if (!response.ok) {
        const error = new Error(
            result?.error?.message || "WhatsApp message could not be sent."
        );

        error.details = result;
        throw error;
    }

    return {
        messageId: result?.messages?.[0]?.id || null,
        recipient,
        response: result,
    };
}

async function sendOrderConfirmationWhatsApp(order) {
    const customerName =
        order.customer?.name ||
        order.buyer?.name ||
        order.shippingAddress?.fullName ||
        "Customer";

    const phone =
        order.customer?.phone ||
        order.buyer?.phone ||
        order.shippingAddress?.phone;

    if (!phone) {
        throw new Error("Customer phone number is missing.");
    }

    return sendWhatsAppTemplate({
        phone,
        templateName:
            process.env.WHATSAPP_ORDER_TEMPLATE_NAME || "order_confirmation",
        languageCode:
            process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
        components: [
            {
                type: "body",
                parameters: [
                    {
                        type: "text",
                        text: customerName,
                    },
                    {
                        type: "text",
                        text: order.orderNumber,
                    },
                    {
                        type: "text",
                        text: `₹${Number(order.totalAmount || 0).toLocaleString("en-IN")}`,
                    },
                ],
            },
        ],
    });
}

module.exports = {
    sendWhatsAppTemplate,
    sendOrderConfirmationWhatsApp,
};