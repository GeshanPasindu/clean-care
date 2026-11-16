import {
  permissionsSchema,
  resultSchema,
  roleResultSchema,
  rolesSchema,
} from "../types/api";
import type { RoleValues } from "../validation/forms";
import { apiRequest } from "./apiClient";

export const roleService = {
  getAssignable: () => apiRequest("roles/assignable", {}, rolesSchema),
  getAll: ({ includeInactive = false }: { includeInactive?: boolean } = {}) =>
    apiRequest(
      `roles${includeInactive ? "?includeInactive=true" : ""}`,
      {},
      rolesSchema,
    ),
  getPermissions: () => apiRequest("roles/permissions", {}, permissionsSchema),
  create: (values: RoleValues) =>
    apiRequest("roles", { method: "POST", body: values }, roleResultSchema),
  update: (id: string, values: Partial<RoleValues>) =>
    apiRequest(
      `roles/${encodeURIComponent(id || "")}`,
      { method: "PUT", body: values },
      roleResultSchema,
    ),
  remove: (id: string) =>
    apiRequest(
      `roles/${encodeURIComponent(id || "")}`,
      { method: "DELETE" },
      resultSchema,
    ),
};
