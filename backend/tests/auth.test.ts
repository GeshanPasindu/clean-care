import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { authService } from "../services/authService.js";
import { account } from "./fixtures.js";
import { serve } from "./http.js";

process.env.ACCESS_TOKEN_SECRET = "test-only-access-token-secret-32-characters";
process.env.FRONTEND_ORIGINS = "http://localhost:3000";
process.env.AUTH_COOKIE_SAME_SITE = "lax";
const { default: app } = await import("../app.js");
let endpoint: Awaited<ReturnType<typeof serve>>;
before(async () => {
  endpoint = await serve(app);
});
after(async () => {
  await endpoint?.close();
});

const headers = {
  "Content-Type": "application/json",
  Origin: "http://localhost:3000",
};
const session = {
  user: account(),
  accessToken: "test-access-token",
  refreshToken: "test-refresh-token",
  expiresAt: new Date("2030-01-01"),
};

test("app loading and unauthenticated routes do not connect to MongoDB", async () => {
  assert.equal(mongoose.connection.readyState, 0);
  for (const path of [
    "users",
    "roles",
    "client/getAllClient",
    "job/getAllJobs",
    "invoice/getAllInvoices",
  ]) {
    const response = await fetch(`${endpoint.url}/api/${path}`);
    assert.equal(response.status, 401, path);
  }
  assert.equal(mongoose.connection.readyState, 0);
});

test("malformed signed token IDs are rejected before database access", async () => {
  const token = jwt.sign(
    { sub: "not-an-id", sid: "invalid" },
    process.env.ACCESS_TOKEN_SECRET || "",
    {
      issuer: "cleancare-api",
      audience: "cleancare-frontend",
      algorithm: "HS256",
    },
  );
  const response = await fetch(`${endpoint.url}/api/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 401);
});

test("login validates and normalizes credentials before authentication", async (context) => {
  const received: string[][] = [];
  const authenticate = context.mock.method(
    authService,
    "authenticateLocal",
    async (email: string, password: string) => {
      received.push([email, password]);
      return null;
    },
  );
  const invalid = await fetch(`${endpoint.url}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email: "bad", password: "password" }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(authenticate.mock.callCount(), 0);
  const response = await fetch(`${endpoint.url}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: " ADMIN@example.com ",
      password: "password",
    }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(received, [["admin@example.com", "password"]]);
});

test("refresh rotates the cookie and exposes only the access token and safe user", async (context) => {
  const received: (string | undefined)[] = [];
  context.mock.method(
    authService,
    "refresh",
    async (token: string | undefined) => {
      received.push(token);
      return session;
    },
  );
  const response = await fetch(`${endpoint.url}/api/auth/refresh`, {
    method: "POST",
    headers: { ...headers, Cookie: "cc_refresh=old-refresh-token" },
    body: "{}",
  });
  assert.equal(response.status, 200);
  assert.deepEqual(received, ["old-refresh-token"]);
  const cookie = response.headers.get("set-cookie") || "";
  assert.match(cookie, /cc_refresh=test-refresh-token/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Path=\/api\/auth/);
  assert.match(cookie, /SameSite=Lax/);
  const result: unknown = await response.json();
  assert.ok(
    result &&
      typeof result === "object" &&
      "accessToken" in result &&
      !("refreshToken" in result),
  );
});

test("untrusted origins cannot invoke authentication services", async (context) => {
  const refresh = context.mock.method(
    authService,
    "refresh",
    async () => session,
  );
  const response = await fetch(`${endpoint.url}/api/auth/refresh`, {
    method: "POST",
    headers: { ...headers, Origin: "https://untrusted.example" },
    body: "{}",
  });
  assert.equal(response.status, 403);
  assert.equal(refresh.mock.callCount(), 0);
});
