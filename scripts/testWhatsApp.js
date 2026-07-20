require("dotenv").config()

const {
    sendWhatsAppTemplate,
} = require("../services/whatsappService");

async function testWhatsAppMessage() {
    try {
        const result = await sendWhatsAppTemplate({
            // Replace this with the WhatsApp number added as a test recipient
            // in Meta WhatsApp API Setup.
            phone: "9730880398",

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
                            text: "Anup",
                        },
                        {
                            type: "text",
                            text: "TEST-ORDER-001",
                        },
                        {
                            type: "text",
                            text: "₹1,500",
                        },
                    ],
                },
            ],
        });

        console.log("WhatsApp test message sent successfully:", {
            messageId: result.messageId,
            recipient: result.recipient,
        });

        process.exit(0);
    } catch (error) {
        console.error("WhatsApp test message failed:", {
            message: error.message,
            details: error.details || null,
        });

        process.exit(1);
    }
}

testWhatsAppMessage();