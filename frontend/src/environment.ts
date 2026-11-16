const apiUrl = import.meta.env.VITE_API_URL?.trim();

if (!apiUrl) {
  throw new Error("VITE_API_URL must be configured in frontend/.env");
}

export const environment = {
  apiUrl: apiUrl.replace(/\/+$/, ""),
};
