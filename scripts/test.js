require("dotenv").config();

const {
    sendBuyerOrderEmail,
} = require("../services/emailService");

async function testBuyerEmail() {
    try {
        const result = await sendBuyerOrderEmail({
            _id: "test-order-id",
            orderNumber: "PS-TEST-001",
            publicAccessToken: "test-token",

            customer: {
                name: "Anup Kumar",
                phone: "9730880398",
                email: process.env.ADMIN_NOTIFICATION_EMAIL,
            },

            shippingAddress: {
                fullName: "Anup Kumar",
                phone: "9730880398",
                addressLine1: "Test address",
                city: "Pune",
                state: "Maharashtra",
                pincode: "411057",
            },

            items: [
                {
                    name: "Mul Cotton Printed Saree",
                    sku: "TEST_001",
                    quantity: 1,
                    listedPrice: 1500,
                    sellingPrice: 1300,
                },
            ],

            subtotal: 1300,
            shippingCharge: 120,
            discount: 0,
            totalAmount: 1420,
            paymentStatus: "PAID",
            razorpayPaymentId: "pay_test_123",
        });

        console.log("Buyer email result:", result);
    } catch (error) {
        console.error("Buyer email failed:", error);
        process.exitCode = 1;
    }
}

testBuyerEmail();