import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import express from "express";
import { validatedService } from "../middleware/validatedController.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { rejectMongoOperators } from "../middleware/requestSecurity.js";
import {
  requestSchema,
  emptySchema,
  idParamsSchema,
} from "../validation/common.js";
import { createJobBodySchema, jobListQuerySchema } from "../validation/job.js";
import { createUser, getAllUsers } from "../controllers/userController.js";
import { userService } from "../services/userService.js";
import type {
  CreateJobInput,
  CreateUserInput,
  UserListQuery,
} from "../types/requests.js";
import type { AuthenticatedUser } from "../types/domain.js";
import { account, jobPayload, userPayload, staffId } from "./fixtures.js";
import { serve } from "./http.js";

process.env.ACCESS_TOKEN_SECRET = "test-only-access-token-secret-32-characters";
const { requirePermissions } = await import("../middleware/authentication.js");

let endpoint: Awaited<ReturnType<typeof serve>>;
let serviceCalls = 0;
let receivedJob: CreateJobInput | undefined;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use(rejectMongoOperators);
  app.use((request, _response, next) => {
    request.user = account();
    next();
  });
  app.post(
    "/jobs/:id",
    validatedService(
      requestSchema(createJobBodySchema, idParamsSchema, jobListQuerySchema),
      async (context) => {
        serviceCalls++;
        receivedJob = context.body;
        return {
          statusCode: 201,
          body: { id: context.params.id, page: context.query.page },
        };
      },
    ),
  );
  app.post("/users", createUser);
  app.get("/users", getAllUsers);
  app.get("/denied", requirePermissions("users.delete"), (_request, response) =>
    response.json({ allowed: true }),
  );
  app.post(
    "/throws",
    validatedService(
      requestSchema(emptySchema, emptySchema, emptySchema),
      async () => {
        throw new Error("sensitive internal detail");
      },
    ),
  );
  app.use(errorHandler);
  endpoint = await serve(app);
});
after(async () => {
  await endpoint?.close();
});

test("validated service receives coerced values and route/query types", async () => {
  const response = await fetch(`${endpoint.url}/jobs/${staffId}?page=2`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(jobPayload),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: staffId, page: 2 });
  assert.equal(receivedJob?.orgHourRate, 30);
  assert.ok(receivedJob?.jobDate instanceof Date);
});

test("invalid bodies, params, and query return 400 without a service call", async () => {
  const beforeCalls = serviceCalls;
  for (const [path, body] of [
    [`/jobs/${staffId}`, { ...jobPayload, assignedStaff: [] }],
    ["/jobs/invalid", jobPayload],
    [`/jobs/${staffId}?page=0`, jobPayload],
  ] satisfies [string, object][]) {
    const response = await fetch(`${endpoint.url}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 400);
    const result: unknown = await response.json();
    assert.ok(result && typeof result === "object" && "issues" in result);
  }
  assert.equal(serviceCalls, beforeCalls);
});

test("Mongo operators are rejected before services", async () => {
  const beforeCalls = serviceCalls;
  const response = await fetch(`${endpoint.url}/jobs/${staffId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...jobPayload, client: { $ne: null } }),
  });
  assert.equal(response.status, 400);
  assert.equal(serviceCalls, beforeCalls);
});

test("the user controller passes normalized payloads to its service", async (context) => {
  const received: CreateUserInput[] = [];
  const create = context.mock.method(
    userService,
    "create",
    async (body: CreateUserInput) => {
      received.push(body);
      return null;
    },
  );
  const response = await fetch(`${endpoint.url}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userPayload),
  });
  assert.equal(response.status, 201);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(received[0]?.email, "employee@example.com");
  assert.equal(received[0]?.dateOfBirth, null);
  assert.ok(received[0]?.dateOfHire instanceof Date);
  const invalid = await fetch(`${endpoint.url}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...userPayload, password: "short" }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(create.mock.callCount(), 1);
});

test("GET controllers validate query strings before invoking services", async (context) => {
  const received: Partial<UserListQuery>[] = [];
  const getAll = context.mock.method(
    userService,
    "getAll",
    async (_actor: AuthenticatedUser, query: Partial<UserListQuery>) => {
      received.push(query);
      return {
        users: [],
        paginationInfo: {
          totalResult: 0,
          totalPages: 0,
          currentPage: query.page || 1,
          pageSize: query.limit || 25,
        },
      };
    },
  );
  const response = await fetch(
    `${endpoint.url}/users?scope=staff&page=2&limit=10`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(received[0], {
    scope: "staff",
    page: 2,
    limit: 10,
    search: "",
  });
  const invalid = await fetch(`${endpoint.url}/users?scope=unknown`);
  assert.equal(invalid.status, 400);
  assert.equal(getAll.mock.callCount(), 1);
});

test("permission checks and generic service errors preserve response boundaries", async (context) => {
  const denied = await fetch(`${endpoint.url}/denied`);
  assert.equal(denied.status, 403);
  context.mock.method(console, "error", () => {});
  const response = await fetch(`${endpoint.url}/throws`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { message: "Internal server error" });
});
