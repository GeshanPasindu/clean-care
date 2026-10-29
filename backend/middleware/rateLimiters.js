import rateLimit from "express-rate-limit";

const rateLimitOptions = (limit, message) => ({
  windowMs: 15 * 60 * 1000,
  limit,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message },
});

export const apiLimiter = rateLimit(
  rateLimitOptions(600, "Too many API requests. Please try again later.")
);

export const authLimiter = rateLimit(
  rateLimitOptions(120, "Too many authentication requests. Please try again later.")
);

export const loginLimiter = rateLimit(
  rateLimitOptions(10, "Too many sign-in attempts. Try again later.")
);
