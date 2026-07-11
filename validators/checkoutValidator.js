const { z } = require("zod")

const checkoutSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  quantity: z.literal(1).default(1),
  paymentMethod: z.enum(["ONLINE", "COD"]),
  customer: z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/),
    email: z.string().email().optional().or(z.literal("")),
  }),
  shippingAddress: z.object({
    fullName: z.string().trim().min(2).max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/),
    addressLine1: z.string().trim().min(5).max(250),
    addressLine2: z.string().trim().max(250).optional(),
    landmark: z.string().trim().max(150).optional(),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    pincode: z.string().regex(/^\d{6}$/),
  }),
  customerNotes: z.string().trim().max(500).optional(),
});

module.exports = { checkoutSchema }
