import passport from "./passport.js";

export const authenticate = (req, res, next) =>
  passport.authenticate("jwt", { session: false }, (error, user) => {
    if (error) return next(error);
    if (!user) return res.status(401).json({ message: "Authentication required" });

    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;
    req.adminId = { id: user.adminDetails || null };
    return next();
  })(req, res, next);

export const requireRoles = (...allowedRoles) => (req, res, next) => {
  if (!req.user || !allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};
