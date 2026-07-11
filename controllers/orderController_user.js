const Order = require("../models/Order_user");

const getPublicOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const { token } = req.query;

    if (!orderNumber || !token) {
      return res.status(400).json({
        message: "Order number and access token are required.",
      });
    }

    const order = await Order.findOne({
      orderNumber,
      publicAccessToken: token,
    })
      .select(
        [
          "orderNumber",
          "orderStatus",
          "paymentStatus",
          "paymentMethod",
          "paymentId",
          "razorpayPaymentId",
          "subtotal",
          "totalListedPrice",
          "totalSoldPrice",
          "discountAmount",
          "discount",
          "shippingAmount",
          "shippingCharge",
          "totalAmount",
          "customer",
          "buyer",
          "shippingAddress",
          "items",
          "tracking",
          "customerNotes",
          "comments",
          "createdAt",
        ].join(" ")
      )
      .lean();

    if (!order) {
      return res.status(404).json({
        message: "Order not found or the access link is invalid.",
      });
    }

    const items = Array.isArray(order.items)
      ? order.items.map((item) => {
        const quantity = Number(item.quantity || 1);

        const soldPrice = Number(
          item.soldPrice ??
          item.sellingPrice ??
          item.offerPrice ??
          item.price ??
          item.listedPrice ??
          0
        );

        const listedPrice = Number(
          item.listedPrice ?? item.price ?? soldPrice
        );

        return {
          productId: item.productId || item._id,
          name: item.name,
          sku: item.sku,
          image:
            item.image ||
            item.imageUrl ||
            item.mainImage ||
            item.mainImageUrl ||
            null,
          quantity,
          soldPrice,
          listedPrice,
          totalPrice: soldPrice * quantity,
        };
      })
      : [];

    const calculatedSubtotal = items.reduce(
      (total, item) => total + item.totalPrice,
      0
    );

    const subtotal = Number(
      order.subtotal ??
      order.totalSoldPrice ??
      calculatedSubtotal
    );

    const discountAmount = Number(
      order.discountAmount ?? order.discount ?? 0
    );

    const shippingAmount = Number(
      order.shippingAmount ?? order.shippingCharge ?? 0
    );

    const totalAmount = Number(
      order.totalAmount ??
      order.totalSoldPrice ??
      subtotal - discountAmount + shippingAmount
    );

    const customerSource = order.customer || order.buyer || {};
    const addressSource = order.shippingAddress || {};

    return res.status(200).json({
      order: {
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,

        orderStatus: order.orderStatus || "confirmed",
        paymentStatus: order.paymentStatus || "pending",
        paymentMethod: order.paymentMethod || null,

        paymentId:
          order.paymentId ||
          order.razorpayPaymentId ||
          null,

        customer: {
          name:
            customerSource.name ||
            customerSource.fullName ||
            addressSource.fullName ||
            null,
          fullName:
            customerSource.fullName ||
            customerSource.name ||
            addressSource.fullName ||
            null,
          phone:
            customerSource.phone ||
            addressSource.phone ||
            null,
          email: customerSource.email || null,
        },

        shippingAddress: {
          fullName:
            addressSource.fullName ||
            customerSource.fullName ||
            customerSource.name ||
            null,
          phone:
            addressSource.phone ||
            customerSource.phone ||
            null,
          addressLine1: addressSource.addressLine1 || null,
          addressLine2: addressSource.addressLine2 || null,
          landmark: addressSource.landmark || null,
          city: addressSource.city || null,
          state: addressSource.state || null,
          pincode:
            addressSource.pincode ||
            addressSource.pinCode ||
            addressSource.postalCode ||
            null,
        },

        items,

        subtotal,
        discountAmount,
        shippingAmount,
        totalAmount,

        tracking: order.tracking || null,

        customerNotes:
          order.customerNotes ||
          order.comments ||
          null,
      },
    });
  } catch (error) {
    console.error("Get public order error:", error);

    return res.status(500).json({
      message: "Unable to retrieve order details.",
    });
  }
};

module.exports = { getPublicOrder };