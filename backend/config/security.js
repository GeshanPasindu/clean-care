export const allowedOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const cookieSameSite = (process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase();
if (!["strict", "lax", "none"].includes(cookieSameSite)) {
  throw new Error("AUTH_COOKIE_SAME_SITE must be strict, lax, or none");
}
export const cookieSecure =
  process.env.AUTH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";

export const authCookieOptions = () => ({
  httpOnly: true,
  secure: cookieSecure || cookieSameSite === "none",
  sameSite: cookieSameSite,
  path: "/api/auth",
});

export function requireTrustedOrigin(req, res, next) {
  const requestOrigin = req.get("origin");
  let refererOrigin = null;
  try {
    refererOrigin = req.get("referer") ? new URL(req.get("referer")).origin : null;
  } catch {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }
  const origin = requestOrigin || refererOrigin;

  if (!origin || !allowedOrigins.includes(origin)) {
    return res.status(403).json({ message: "Request origin is not allowed" });
  }

  return next();
}
