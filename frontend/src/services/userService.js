import { apiRequest } from "./apiClient";

const withQuery = (path, params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export const userService = {
  create: (values) => apiRequest("users", { method: "POST", body: values }),
  getAll: (params = {}) => apiRequest(withQuery("users", params)),
  getCount: (scope = "employees") => apiRequest(withQuery("users/count", { scope })),
  getDeleted: () => apiRequest("users/deleted"),
  getMe: () => apiRequest("users/me"),
  getById: (id) => apiRequest(`users/${encodeURIComponent(id)}`),
  update: (id, values) => apiRequest(`users/${encodeURIComponent(id)}`, { method: "PUT", body: values }),
  changeRole: (id, values) => apiRequest(`users/${encodeURIComponent(id)}/role`, { method: "PATCH", body: values }),
  updateProfile: (_id, values) => apiRequest("users/me", { method: "PUT", body: values }),
  updateStatus: (id, status) => apiRequest(`users/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } }),
  resetPassword: (id, password) => apiRequest(`users/${encodeURIComponent(id)}/password`, { method: "PUT", body: { password } }),
  changeOwnPassword: (values) => apiRequest("users/me/password", { method: "PUT", body: values }),
  remove: (id) => apiRequest(`users/${encodeURIComponent(id)}`, { method: "DELETE" }),
  restore: (id) => apiRequest(`users/${encodeURIComponent(id)}/restore`, { method: "POST", body: {} }),
};
