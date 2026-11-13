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
    apiRequest("users/me/password", { method: "PUT", body: values }),
};
