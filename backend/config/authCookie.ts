import type { HttpResponse } from "../types/http.js";
import type { SessionResult } from "../types/models.js";
import { authCookieOptions } from "./security.js";
export const refreshCookieName = "cc_refresh";
export function setRefreshCookie(res: HttpResponse, session: Pick<SessionResult, "refreshToken" | "expiresAt">): void {
  res.cookie(refreshCookieName, session.refreshToken, { ...authCookieOptions(), expires: session.expiresAt, maxAge: Math.max(0, session.expiresAt.getTime() - Date.now()) });
}
export function clearRefreshCookie(res: HttpResponse): void { res.clearCookie(refreshCookieName, authCookieOptions()); }
