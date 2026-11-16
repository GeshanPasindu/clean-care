import passport from "./passport.js";
import type { HttpHandler } from "../types/http.js";
import { authenticatedUserSchema } from "../validation/auth.js";

export const authenticate: HttpHandler = (req, res, next) =>
  passport.authenticate("jwt", { session: false }, (error: unknown, candidate: unknown) => {
    if (error) return next(error);
    const parsed = authenticatedUserSchema.safeParse(candidate);
    if (!parsed.success) return res.status(401).json({ message: "Authentication required" });
    req.user = parsed.data;
    return next();
  })(req, res, next);

export const requirePermissions = (...permissions: string[]): HttpHandler => (req, res, next) => {
  const granted = new Set(req.user?.permissions || []);
  if (!req.user || permissions.some((permission) => !granted.has(permission))) return res.status(403).json({ message: "Access denied" });
  return next();
};
