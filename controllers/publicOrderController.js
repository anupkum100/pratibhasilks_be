const PublicOrder = require("../models/PublicOrder");

const PUBLIC_ORDER_SELECT_FIELDS = [
  "orderNumber",
  "orderStatus",
  "paymentStatus",
  "paymentMethod",
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
  "createdAt",
  "updatedAt",
].join(" ");

const ORDER_SELECT_FIELDS = [
  "orderNumber",
  "orderStatus",
  "paymentStatus",
  "paymentMethod",
  "paymentId",
  "razorpayOrderId",
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
  "notes",
  "createdAt",
  "updatedAt",
].join(" ");

const getPublicOrder = async (req, res) => {
  try {
    const { orderNumber } = req.params;
    const token =
      req.get("x-public-access-token") ||
      req.query.token;

    if (!orderNumber || !token) {
      return res.status(400).json({
        message: "Order number and access token are required.",
      });
    }

    const order = await PublicOrder.findOne({
      orderNumber,
      publicAccessToken: token,
    })
      .select(PUBLIC_ORDER_SELECT_FIELDS)
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
          order.customerNotes || null,
      },
    });
  } catch (error) {
    console.error("Get public order error:", error);

    return res.status(500).json({
      message: "Unable to retrieve order details.",
    });
  }
};

const normalizeOrderItem = (item = {}) => {
  const quantity = Number(item.quantity || 1);

  const sellingPrice = Number(
    item.sellingPrice ??
    item.soldPrice ??
    item.offerPrice ??
    item.price ??
    item.listedPrice ??
    0
  );

  const listedPrice = Number(
    item.listedPrice ??
    item.originalPrice ??
    item.price ??
    sellingPrice
  );

  return {
    productId: item.productId || item._id || null,
    name: item.name || null,
    sku: item.sku || null,

    image:
      item.image ||
      item.imageUrl ||
      item.mainImage ||
      item.mainImageUrl ||
      item.productImage ||
      null,

    quantity,
    sellingPrice,
    soldPrice: sellingPrice,
    listedPrice,
    totalPrice: sellingPrice * quantity,

    fabric: item.fabric || null,
    color: item.color || null,
  };
};

const normalizeOrder = (order = {}) => {
  const items = Array.isArray(order.items)
    ? order.items.map(normalizeOrderItem)
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
    order.discountAmount ??
    order.discount ??
    0
  );

  const shippingAmount = Number(
    order.shippingAmount ??
    order.shippingCharge ??
    0
  );

  const totalAmount = Number(
    order.totalAmount ??
    order.totalSoldPrice ??
    subtotal - discountAmount + shippingAmount
  );

  const customerSource =
    order.customer || order.buyer || {};

  const addressSource =
    order.shippingAddress || {};

  return {
    _id: order._id,

    orderNumber: order.orderNumber,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,

    orderStatus:
      order.orderStatus || "confirmed",

    paymentStatus:
      order.paymentStatus || "pending",

    paymentMethod:
      order.paymentMethod || null,

    paymentId:
      order.paymentId ||
      order.razorpayPaymentId ||
      null,

    razorpayOrderId:
      order.razorpayOrderId || null,

    razorpayPaymentId:
      order.razorpayPaymentId ||
      order.paymentId ||
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

      email:
        customerSource.email || null,
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

      addressLine1:
        addressSource.addressLine1 || null,

      addressLine2:
        addressSource.addressLine2 || null,

      landmark:
        addressSource.landmark || null,

      city:
        addressSource.city || null,

      state:
        addressSource.state || null,

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

    tracking:
      order.tracking || null,

    customerNotes:
      order.customerNotes ||
      order.comments ||
      order.notes ||
      null,
  };
};

const escapeRegex = (value = "") => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getOrderSort = (sort) => {
  switch (sort) {
    case "oldest":
      return {
        createdAt: 1,
        _id: 1,
      };

    case "amount_high_low":
      return {
        totalAmount: -1,
        createdAt: -1,
      };

    case "amount_low_high":
      return {
        totalAmount: 1,
        createdAt: -1,
      };

    case "latest":
    default:
      return {
        createdAt: -1,
        _id: -1,
      };
  }
};

const getAllOrders = async (req, res) => {
  try {
    const page = Math.max(
      Number.parseInt(req.query.page, 10) || 1,
      1
    );

    const limit = Math.min(
      Math.max(
        Number.parseInt(req.query.limit, 10) || 20,
        1
      ),
      100
    );

    const search = String(
      req.query.search || ""
    ).trim();

    const orderStatus = String(
      req.query.orderStatus || ""
    ).trim();

    const paymentStatus = String(
      req.query.paymentStatus || ""
    ).trim();

    const sort = String(
      req.query.sort || "latest"
    ).trim();

    const skip = (page - 1) * limit;

    const filter = {};

    if (orderStatus) {
      filter.orderStatus = {
        $regex: new RegExp(
          `^${escapeRegex(orderStatus)}$`,
          "i"
        ),
      };
    }

    if (paymentStatus) {
      filter.paymentStatus = {
        $regex: new RegExp(
          `^${escapeRegex(paymentStatus)}$`,
          "i"
        ),
      };
    }

    if (search) {
      const searchRegex = new RegExp(
        escapeRegex(search),
        "i"
      );

      filter.$or = [
        {
          orderNumber: searchRegex,
        },
        {
          "customer.name": searchRegex,
        },
        {
          "customer.fullName": searchRegex,
        },
        {
          "customer.phone": searchRegex,
        },
        {
          "customer.email": searchRegex,
        },
        {
          "buyer.name": searchRegex,
        },
        {
          "buyer.fullName": searchRegex,
        },
        {
          "buyer.phone": searchRegex,
        },
        {
          "buyer.email": searchRegex,
        },
        {
          "shippingAddress.fullName": searchRegex,
        },
        {
          "shippingAddress.phone": searchRegex,
        },
        {
          "shippingAddress.city": searchRegex,
        },
        {
          "shippingAddress.state": searchRegex,
        },
        {
          "shippingAddress.pincode": searchRegex,
        },
        {
          "items.name": searchRegex,
        },
        {
          "items.sku": searchRegex,
        },
        {
          razorpayOrderId: searchRegex,
        },
        {
          razorpayPaymentId: searchRegex,
        },
        {
          paymentId: searchRegex,
        },
      ];
    }

    const sortConfig = getOrderSort(sort);

    const [
      orders,
      totalOrders,
      summaryResult,
    ] = await Promise.all([
      PublicOrder.find(filter)
        .select(ORDER_SELECT_FIELDS)
        .sort(sortConfig)
        .skip(skip)
        .limit(limit)
        .lean(),

      PublicOrder.countDocuments(filter),

      PublicOrder.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: null,

            paidOrders: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $toUpper: {
                          $ifNull: [
                            "$paymentStatus",
                            "",
                          ],
                        },
                      },
                      "PAID",
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            pendingOrders: {
              $sum: {
                $cond: [
                  {
                    $in: [
                      {
                        $toUpper: {
                          $ifNull: [
                            "$orderStatus",
                            "",
                          ],
                        },
                      },
                      [
                        "PENDING",
                        "CONFIRMED",
                        "PROCESSING",
                      ],
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            totalRevenue: {
              $sum: {
                $cond: [
                  {
                    $eq: [
                      {
                        $toUpper: {
                          $ifNull: [
                            "$paymentStatus",
                            "",
                          ],
                        },
                      },
                      "PAID",
                    ],
                  },
                  {
                    $convert: {
                      input: {
                        $ifNull: [
                          "$totalAmount",
                          {
                            $ifNull: [
                              "$totalSoldPrice",
                              0,
                            ],
                          },
                        ],
                      },
                      to: "double",
                      onError: 0,
                      onNull: 0,
                    },
                  },
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const normalizedOrders =
      orders.map(normalizeOrder);

    const totalPages = Math.ceil(
      totalOrders / limit
    );

    const summary =
      summaryResult?.[0] || {};

    return res.status(200).json({
      data: normalizedOrders,

      summary: {
        totalOrders,

        paidOrders: Number(
          summary.paidOrders || 0
        ),

        pendingOrders: Number(
          summary.pendingOrders || 0
        ),

        totalRevenue: Number(
          summary.totalRevenue || 0
        ),
      },

      pagination: {
        page,
        limit,
        totalOrders,
        totalItems: totalOrders,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error) {
    console.error(
      "Get all orders error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to retrieve online orders.",
    });
  }
};

module.exports = {
  getAllOrders,
  getPublicOrder
};
