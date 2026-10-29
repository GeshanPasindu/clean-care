import axios from "axios";
import { environment } from "../environment";

let accessToken = null;
let refreshPromise = null;
const apiOrigin = new URL(environment.apiUrl).origin;
const apiPath = new URL(environment.apiUrl).pathname.replace(/\/$/, "");

export const setAccessToken = (token) => {
  accessToken = typeof token === "string" && token ? token : null;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export const getAccessToken = () => accessToken;

function isApiRequest(config) {
  try {
    const url = new URL(config.url || "", config.baseURL || environment.apiUrl);
    return url.origin === apiOrigin && url.pathname.startsWith(apiPath);
  } catch {
    return false;
  }
}

function isAuthEndpoint(config) {
  try {
    const url = new URL(config.url || "", config.baseURL || environment.apiUrl);
    return /\/auth\/(login|refresh|logout|logout-all)$/.test(url.pathname);
  } catch {
    return false;
  }
}

function notify(name, detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true, _skipAuthRefresh: true })
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        notify("cleancare:session-updated", data.user);
        return data;
      })
      .catch((error) => {
        clearAccessToken();
        notify("cleancare:session-expired");
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

axios.interceptors.request.use((config) => {
  if (isApiRequest(config)) {
    config.withCredentials = true;
    config.headers = config.headers || {};
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    else if (config.headers.Authorization) delete config.headers.Authorization;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (
      error.response?.status !== 401 ||
      !config ||
      config._retryAuth ||
      config._skipAuthRefresh ||
      !isApiRequest(config) ||
      isAuthEndpoint(config)
    ) {
      return Promise.reject(error);
    }

    config._retryAuth = true;
    try {
      const session = await refreshSession();
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${session.accessToken}`;
      return axios.request(config);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export default axios;
