import { apiRequest } from "./apiClient";

export const staffService = {
  getAll: () => apiRequest("staff/getAllStaff"),
  getAllActive: () => apiRequest("staff/getAllActiveStaff"),
  getById: (id) => apiRequest(`staff/getStaffById/${encodeURIComponent(id)}`),
  getCount: () => apiRequest("staff/getAllStaffCount"),
  remove: (id) => apiRequest(`staff/deleteStaffById/${encodeURIComponent(id)}`, { method: "DELETE" }),
  updateStatus: (id, status) =>
    apiRequest(`staff/updateStatus/${encodeURIComponent(id)}`, { method: "PATCH", body: { workStatus: status } }),
};
