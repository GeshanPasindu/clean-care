import { resultSchema, sessionSchema } from "../types/api";
import type { ChangePasswordValues, LoginValues } from "../validation/forms";
import { apiRequest } from "./apiClient";
import type { FirstLoginValues } from "../validation/auth";
export const authService = {
  completeFirstLogin: (token: string, values: FirstLoginValues) =>
    apiRequest(
      "auth/first-login",
      {
        method: "POST",
        body: {
          token,
          temporaryPassword: values.temporaryPassword,
          newPassword: values.newPassword,
        },
        includeAuth: false,
        skipAuthRefresh: true,
      },
      resultSchema,
    ),
  login: (credentials: LoginValues) =>
    apiRequest(
      "auth/login",
      {
        method: "POST",
        body: credentials,
        includeAuth: false,
        skipAuthRefresh: true,
      },
      sessionSchema,
    ),
  logout: () =>
    apiRequest(
      "auth/logout",
      { method: "POST", body: {}, skipAuthRefresh: true },
      resultSchema,
    ),
  changePassword: (values: ChangePasswordValues) =>
    apiRequest(
      "users/me/password",
      { method: "PUT", body: values },
      resultSchema,
    ),
};
