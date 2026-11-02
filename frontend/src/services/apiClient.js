import { environment } from "../environment";

const apiBaseUrl = environment.apiUrl.replace(/\/+$/, "");
const configuredUrl = new URL(apiBaseUrl);
const apiPath = configuredUrl.pathname.replace(/\/+$/, "");

let accessToken = null;
let refreshPromise = null;

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const setAccessToken = (token) => {
  accessToken = typeof token === "string" && token ? token : null;
};

export const clearAccessToken = () => {
  accessToken = null;
};

export const getAccessToken = () => accessToken;

function notify(name, detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function buildUrl(path, params) {
  const url = new URL(String(path).replace(/^\/+/, ""), `${apiBaseUrl}/`);
  const isUnderConfiguredApi =
    url.origin === configuredUrl.origin &&
    (url.pathname === apiPath || url.pathname.startsWith(`${apiPath}/`));

  if (!isUnderConfiguredApi) {
    throw new Error("API requests must use the configured VITE_API_URL");
  }

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    });
  }

  return url;
}

async function readResponse(response) {
  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
}

function prepareBody(body, headers) {
  if (body === undefined || body === null) return undefined;
  if (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams
  ) {
    return body;
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return JSON.stringify(body);
}

function isAuthEndpoint(url) {
  return /\/auth\/(login|refresh|logout|logout-all)$/.test(url.pathname);
}

async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = apiRequest("auth/refresh", {
      method: "POST",
      body: {},
      includeAuth: false,
      skipAuthRefresh: true,
    })
      .then((session) => {
        setAccessToken(session.accessToken);
        notify("cleancare:session-updated", session.user);
        return session;
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

export async function apiRequest(path, options = {}) {
  const {
    method = "GET",
    headers: suppliedHeaders,
    body,
    params,
    signal,
    includeAuth = true,
    skipAuthRefresh = false,
  } = options;
  const url = buildUrl(path, params);
  const headers = new Headers(suppliedHeaders || {});
  const requestBody = prepareBody(body, headers);

  const send = () => {
    const requestHeaders = new Headers(headers);
    if (includeAuth && accessToken) {
      requestHeaders.set("Authorization", `Bearer ${accessToken}`);
    } else {
      requestHeaders.delete("Authorization");
    }

    return fetch(url, {
      method,
      headers: requestHeaders,
      body: requestBody,
      credentials: "include",
      signal,
    });
  };

  let response = await send();
  if (
    response.status === 401 &&
    !skipAuthRefresh &&
    !isAuthEndpoint(url)
  ) {
    const session = await refreshSession();
    setAccessToken(session.accessToken);
    response = await send();
  }

  const data = await readResponse(response);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && (data.message || data.error)
        ? data.message || data.error
        : response.statusText || "The request failed";
    throw new ApiError(message, response.status, data);
  }

  return data;
}

export { refreshSession };
