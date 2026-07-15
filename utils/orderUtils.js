const crypto = require("crypto");

const publicToken = () => crypto.randomBytes(24).toString("hex");

const generateOrderNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `PS-${date}-${crypto.randomInt(100000, 999999)}`;
};

const sellingPriceOf = (product) => {
  const regular = Number(product.price);
  const offer = Number(product.offerPrice);
  return Number.isFinite(offer) && offer > 0 && offer < regular ? offer : regular;
};

const shippingChargeFor = (subtotal, itemCount = 1, state = "") => {
  const threshold = Number(process.env.FREE_SHIPPING_THRESHOLD || 5000);
  const charge = Number(process.env.BASE_SAREE_SHIPPING || 120);
  const additionalCharge = Number(process.env.ADDITIONAL_SAREE_SHIPPING || 100);
  const safeItemCount = Math.max(1, Number(itemCount) || 1);
  const normalizedState = String(state || "").trim();

  if (!normalizedState) return 0;

  if (threshold > 0 && subtotal > threshold) return 0;

  return charge + ((safeItemCount - 1) * additionalCharge);
};

module.exports = { publicToken, generateOrderNumber, sellingPriceOf, shippingChargeFor }
