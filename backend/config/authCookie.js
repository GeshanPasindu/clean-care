import { authCookieOptions } from "./security.js";

export const refreshCookieName = "cc_refresh";

export function setRefreshCookie(res, session) {
  res.cookie(refreshCookieName, session.refreshToken, {
    ...authCookieOptions(),
    expires: session.expiresAt,
    maxAge: Math.max(0, session.expiresAt.getTime() - Date.now()),
  });
}

export function clearRefreshCookie(res) {
  res.clearCookie(refreshCookieName, authCookieOptions());
}
