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

const shippingChargeFor = (subtotal) => {
  const threshold = Number(process.env.FREE_SHIPPING_THRESHOLD || 0);
  const charge = Number(process.env.DEFAULT_SHIPPING_CHARGE || 0);
  return threshold > 0 && subtotal < threshold ? charge : 0;
};

module.exports = { publicToken, generateOrderNumber, sellingPriceOf, shippingChargeFor }
