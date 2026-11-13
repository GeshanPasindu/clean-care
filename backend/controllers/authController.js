import passport from "passport";
import { clearRefreshCookie, refreshCookieName, setRefreshCookie } from "../config/authCookie.js";
import { authService } from "../services/authService.js";
import { ServiceError } from "../services/serviceError.js";

export const login = (req, res, next) => {
  passport.authenticate("local", { session: false }, async (error, user) => {
    if (error) return next(error);
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    try {
      const session = await authService.createSession(user, {
        userAgent: req.get("user-agent"),
        ipAddress: req.ip,
      });
      setRefreshCookie(res, session);
      return res.status(200).json({ success: true, accessToken: session.accessToken, user: session.user });
    } catch (sessionError) {
      return next(sessionError);
    }
  })(req, res, next);
};

export const refresh = async (req, res, next) => {
  try {
    const session = await authService.refresh(req.cookies?.[refreshCookieName]);
    setRefreshCookie(res, session);
    return res.status(200).json({ success: true, accessToken: session.accessToken, user: session.user });
  } catch (error) {
    if (error instanceof ServiceError && error.statusCode === 401) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: error.message });
    }
    return next(error);
  }
};

export const logout = async (req, res) => {
  await authService.logout(req.cookies?.[refreshCookieName]);
  clearRefreshCookie(res);
  return res.status(200).json({ success: true });
};

export const logoutAll = async (req, res) => {
  await authService.revokeAll(req.user._id);
  clearRefreshCookie(res);
  return res.status(200).json({ success: true });
};
