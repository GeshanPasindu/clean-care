import passport from "./passport.js";

export const authenticate = (req, res, next) =>
  passport.authenticate("jwt", { session: false }, (error, user) => {
    if (error) return next(error);
    if (!user) return res.status(401).json({ message: "Authentication required" });

    req.user = user;
    return next();
  })(req, res, next);

export const requirePermissions = (...requiredPermissions) => (req, res, next) => {
  const userPermissions = new Set(req.user?.permissions || []);
  if (!req.user || requiredPermissions.some((permission) => !userPermissions.has(permission))) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};
