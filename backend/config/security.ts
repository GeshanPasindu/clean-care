import type { CookieOptions } from "express";
import { z } from "zod";
import type { HttpHandler } from "../types/http.js";

export const allowedOrigins = (process.env.FRONTEND_ORIGINS || "http://localhost:3000").split(",").map((origin) => origin.trim()).filter(Boolean);
export const cookieSameSite = z.enum(["strict", "lax", "none"]).parse((process.env.AUTH_COOKIE_SAME_SITE || "lax").toLowerCase());
export const cookieSecure = process.env.AUTH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
export const authCookieOptions = (): CookieOptions => ({ httpOnly: true, secure: cookieSecure || cookieSameSite === "none", sameSite: cookieSameSite, path: "/api/auth" });
export const requireTrustedOrigin: HttpHandler = (req, res, next) => {
  const requestOrigin = req.get("origin");
  let refererOrigin: string | null = null;
  try { refererOrigin = req.get("referer") ? new URL(req.get("referer") || "").origin : null; }
  catch { return res.status(403).json({ message: "Request origin is not allowed" }); }
  const origin = requestOrigin || refererOrigin;
  if (!origin || !allowedOrigins.includes(origin)) return res.status(403).json({ message: "Request origin is not allowed" });
  return next();
};
