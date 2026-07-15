const buckets = new Map();

const defaultKeyGenerator = (req) => {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();

  return forwardedFor || req.ip || req.socket?.remoteAddress || "unknown";
};

const rateLimit = ({
  windowMs = 60_000,
  max = 60,
  keyGenerator = defaultKeyGenerator,
  message = "Too many requests. Please try again later.",
} = {}) => {
  return (req, res, next) => {
    const now = Date.now();
    const routePath =
      req.baseUrl && req.route?.path
        ? `${req.baseUrl}${req.route.path}`
        : req.originalUrl.split("?")[0];
    const key = `${req.method}:${routePath}:${keyGenerator(req)}`;
    const current = buckets.get(key);

    if (buckets.size > 10_000) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.expiresAt <= now) {
          buckets.delete(bucketKey);
        }
      }
    }

    if (!current || current.expiresAt <= now) {
      buckets.set(key, {
        count: 1,
        expiresAt: now + windowMs,
      });

      return next();
    }

    current.count += 1;

    if (current.count > max) {
      res.set("Retry-After", String(Math.ceil((current.expiresAt - now) / 1000)));
      return res.status(429).json({
        success: false,
        message,
      });
    }

    return next();
  };
};

module.exports = rateLimit;
