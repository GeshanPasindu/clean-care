import type { QueryParams } from "../types/api";
import {
  countSchema,
  resultSchema,
  userResultSchema,
  usersSchema,
  createdUserSchema,
  invitationResultSchema,
} from "../types/api";
import type { AccountStatus } from "../types/domain";
import type { CreateUserInput, UpdateUserInput } from "../types/requests";
import type {
  ChangePasswordValues,
  ProfileValues,
  RoleAssignment,
} from "../validation/forms";
import { apiRequest } from "./apiClient";

const withQuery = (path: string, params: QueryParams = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export const userService = {
  create: (values: CreateUserInput) =>
    apiRequest("users", { method: "POST", body: values }, createdUserSchema),
  replaceFirstLoginInvitation: (id: string, password: string) =>
    apiRequest(
      `users/${encodeURIComponent(id)}/first-login-invitation`,
      { method: "POST", body: { password } },
      invitationResultSchema,
    ),
  getAll: (params: QueryParams = {}) =>
    apiRequest(withQuery("users", params), {}, usersSchema),
  getCount: (scope: string = "employees") =>
    apiRequest(withQuery("users/count", { scope }), {}, countSchema),
  getDeleted: () => apiRequest("users/deleted", {}, usersSchema),
  getMe: () => apiRequest("users/me", {}, userResultSchema),
  getById: (id: string | undefined) =>
    apiRequest(`users/${encodeURIComponent(id || "")}`, {}, userResultSchema),
  update: (id: string | undefined, values: UpdateUserInput) =>
    apiRequest(
      `users/${encodeURIComponent(id || "")}`,
      { method: "PUT", body: values },
      userResultSchema,
    ),
  changeRole: (id: string, values: RoleAssignment) =>
    apiRequest(
      `users/${encodeURIComponent(id || "")}/role`,
      { method: "PATCH", body: values },
      userResultSchema,
    ),
  updateProfile: (_id: string | undefined, values: ProfileValues) =>
    apiRequest("users/me", { method: "PUT", body: values }, userResultSchema),
  updateStatus: (id: string, status: AccountStatus) =>
    apiRequest(
      `users/${encodeURIComponent(id || "")}/status`,
      { method: "PATCH", body: { status } },
      userResultSchema,
    ),
  resetPassword: (id: string, password: string) =>
    apiRequest(
      `users/${encodeURIComponent(id || "")}/password`,
      { method: "PUT", body: { password } },
      resultSchema,
    ),
  changeOwnPassword: (values: ChangePasswordValues) =>
    apiRequest(
      "users/me/password",
      { method: "PUT", body: values },
      resultSchema,
    ),
  remove: (id: string) =>
    apiRequest(
      `users/${encodeURIComponent(id || "")}`,
      { method: "DELETE" },
      resultSchema,
    ),
  restore: (id: string) =>
    apiRequest(
      `users/${encodeURIComponent(id || "")}/restore`,
      { method: "POST", body: {} },
      resultSchema,
    ),
};
