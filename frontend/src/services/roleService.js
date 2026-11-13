import { apiRequest } from "./apiClient";

export const roleService = {
  getAssignable: () => apiRequest("roles/assignable"),
  getAll: ({ includeInactive = false } = {}) => apiRequest(`roles${includeInactive ? "?includeInactive=true" : ""}`),
  getPermissions: () => apiRequest("roles/permissions"),
  create: (values) => apiRequest("roles", { method: "POST", body: values }),
  update: (id, values) => apiRequest(`roles/${encodeURIComponent(id)}`, { method: "PUT", body: values }),
  remove: (id) => apiRequest(`roles/${encodeURIComponent(id)}`, { method: "DELETE" }),
};
