import { apiRequest } from "./apiClient";

export const adminService = {
  getAll: () => apiRequest("admin/getAllAdmins"),
  updateStatus: (id, status) =>
    apiRequest(`admin/updateStatus/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { status },
    }),
  updatePassword: (id, password) =>
    apiRequest(`admin/updateAdminPassword/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: { password },
    }),
};
