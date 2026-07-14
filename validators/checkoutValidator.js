const { z } = require("zod");

const checkoutSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "Product SKU is required.")
    .max(80, "Invalid product SKU."),

  quantity: z.literal(1).default(1),

  paymentMethod: z.enum(["ONLINE", "COD"], {
    errorMap: () => ({
      message: "Please select a payment method.",
    }),
  }),

  customer: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Full name should be at least 2 characters.")
      .max(100, "Full name cannot exceed 100 characters."),

    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number."),

    email: z
      .string()
      .email("Please enter a valid email address.")
      .optional()
      .or(z.literal("")),
  }),

  shippingAddress: z.object({
    fullName: z
      .string()
      .trim()
      .min(2, "Recipient name should be at least 2 characters.")
      .max(100, "Recipient name cannot exceed 100 characters."),

    phone: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number."),

    addressLine1: z
      .string()
      .trim()
      .min(5, "Address line 1 should be at least 5 characters.")
      .max(250, "Address line 1 cannot exceed 250 characters."),

    addressLine2: z
      .string()
      .trim()
      .max(250, "Address line 2 cannot exceed 250 characters.")
      .optional(),

    landmark: z
      .string()
      .trim()
      .max(150, "Landmark cannot exceed 150 characters.")
      .optional(),

    city: z
      .string()
      .trim()
      .min(2, "City should be at least 2 characters.")
      .max(80, "City cannot exceed 80 characters."),

    state: z
      .string()
      .trim()
      .min(2, "State should be at least 2 characters.")
      .max(80, "State cannot exceed 80 characters."),

    pincode: z
      .string()
      .regex(/^\d{6}$/, "Please enter a valid 6-digit PIN code."),
  }),

  customerNotes: z
    .string()
    .trim()
    .max(500, "Order notes cannot exceed 500 characters.")
    .optional(),
});

module.exports = { checkoutSchema };