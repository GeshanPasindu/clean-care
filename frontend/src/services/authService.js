import { apiRequest } from "./apiClient";

export const authService = {
  login: (credentials) =>
    apiRequest("auth/login", {
      method: "POST",
      body: credentials,
      includeAuth: false,
      skipAuthRefresh: true,
    }),
  logout: () => apiRequest("auth/logout", { method: "POST", body: {}, skipAuthRefresh: true }),
  changePassword: (values) =>
    apiRequest("auth/change-password", { method: "POST", body: values }),
};
