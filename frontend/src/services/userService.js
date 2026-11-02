import { apiRequest } from "./apiClient";

export const userService = {
  create: (values) => apiRequest("user/addUser", { method: "POST", body: values }),
  getById: (id) => apiRequest(`user/getUser/${encodeURIComponent(id)}`),
  remove: (id) => apiRequest(`user/deleteUser/${encodeURIComponent(id)}`, { method: "DELETE" }),
  updateProfile: (id, values) =>
    apiRequest(`user/userUpdate/${encodeURIComponent(id)}`, { method: "PUT", body: values }),
  updateStaff: (id, values) =>
    apiRequest(`user/updateStaff/${encodeURIComponent(id)}`, { method: "PUT", body: values }),
  updateAdmin: (id, values) =>
    apiRequest(`user/updateAdmin/${encodeURIComponent(id)}`, { method: "PUT", body: values }),
};
