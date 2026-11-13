import {
  clearRefreshCookie,
  refreshCookieName,
  setRefreshCookie,
} from "../config/authCookie.js";
import { authService } from "../services/authService.js";
import { ServiceError } from "../services/serviceError.js";
import type { HttpHandler, HttpRequest } from "../types/http.js";
import { validatedController } from "../middleware/validatedController.js";
import { requestSchema, emptySchema } from "../validation/common.js";
import { loginBodySchema, refreshCookiesSchema } from "../validation/auth.js";

function refreshCookie(request: HttpRequest): string | undefined {
  const cookies: unknown = request.cookies;
  const parsed = refreshCookiesSchema.safeParse(cookies || {});
  return parsed.success ? parsed.data[refreshCookieName] : undefined;
}

export const login: HttpHandler = async (req, res) => {
  const input = requestSchema(loginBodySchema, emptySchema, emptySchema).parse({
    body: req.body,
    params: req.params,
    query: req.query,
  });
  const user = await authService.authenticateLocal(
    input.body.email,
    input.body.password,
  );
  if (!user)
    return res.status(401).json({ message: "Invalid email or password" });
  const session = await authService.createSession(user, {
    userAgent: req.get("user-agent"),
    ipAddress: req.ip,
  });
  setRefreshCookie(res, session);
  return res
    .status(200)
    .json({
      success: true,
      accessToken: session.accessToken,
      user: session.user,
    });
};

const emptyRequest = requestSchema(emptySchema, emptySchema, emptySchema);
export const refresh: HttpHandler = async (req, res, next) => {
  emptyRequest.parse({ body: req.body, params: req.params, query: req.query });
  try {
    const session = await authService.refresh(refreshCookie(req));
    setRefreshCookie(res, session);
    return res
      .status(200)
      .json({
        success: true,
        accessToken: session.accessToken,
        user: session.user,
      });
  } catch (error) {
    if (error instanceof ServiceError && error.statusCode === 401) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: error.message });
    }
    return next(error);
  }
};
export const logout: HttpHandler = async (req, res) => {
  emptyRequest.parse({ body: req.body, params: req.params, query: req.query });
  await authService.logout(refreshCookie(req));
  clearRefreshCookie(res);
  return res.status(200).json({ success: true });
};
export const logoutAll = validatedController(
  emptyRequest,
  async (_input, user, _req, res) => {
    await authService.revokeAll(user._id);
    clearRefreshCookie(res);
    return res.status(200).json({ success: true });
  },
);
