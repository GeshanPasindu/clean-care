import passport from "passport";
import { authCookieOptions } from "../config/security.js";
import { authService } from "../services/authService.js";
import { ServiceError } from "../services/serviceError.js";

const refreshCookieName = "cc_refresh";

const setRefreshCookie = (res, session) => {
  res.cookie(refreshCookieName, session.refreshToken, {
    ...authCookieOptions(),
    expires: session.expiresAt,
    maxAge: Math.max(0, session.expiresAt.getTime() - Date.now()),
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie(refreshCookieName, authCookieOptions());
};

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

export const me = async (req, res) => (
  res.status(200).json({ success: true, user: await authService.getSafeUser(req.user) })
);

export const changePassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user._id, req.body?.currentPassword, req.body?.newPassword);
    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: "Password updated. Please sign in again." });
  } catch (error) {
    if (error instanceof ServiceError) return res.status(error.statusCode).json({ message: error.message });
    return next(error);
  }
};

export const authConfig = { refreshCookieName };
