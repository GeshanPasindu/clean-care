import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";
import type { FilterQuery } from "mongoose";
import Job from "../models/jobModel.js";
import Client from "../models/clientModel.js";
import Role from "../models/roleModel.js";
import User from "../models/userModel.js";
import type { UserRecord, RoleRecord } from "../types/models.js";
import { addJob } from "../services/jobService.js";
import { jobScope } from "../services/authorizationService.js";
import { createJobBodySchema } from "../validation/job.js";
import {
  account,
  actorId,
  staffId,
  roleId,
  clientId,
  jobPayload,
} from "./fixtures.js";

test("job creation uses Staff roles and the client owner for tenant assignment", async (context) => {
  const staffRoleId = new Types.ObjectId(roleId);
  const clientOwner = new Types.ObjectId("507f1f77bcf86cd799439099");
  const roleFilters: FilterQuery<RoleRecord>[] = [];
  const staffFilters: FilterQuery<UserRecord>[] = [];
  context.mock.method(Role, "find", (filter: FilterQuery<RoleRecord>) => {
    roleFilters.push(filter);
    return { select: () => ({ lean: async () => [{ _id: staffRoleId }] }) };
  });
  context.mock.method(Client, "findOne", () => ({
    select: async () => ({
      _id: new Types.ObjectId(clientId),
      tenantId: clientOwner,
    }),
  }));
  context.mock.method(User, "find", (filter: FilterQuery<UserRecord>) => {
    staffFilters.push(filter);
    return { select: async () => [{ _id: new Types.ObjectId(staffId) }] };
  });
  const saved: JobRecordForTest[] = [];
  context.mock.method(Job, "create", async (data: JobRecordForTest) => {
    saved.push(data);
    return new Job(data);
  });
  const result = await addJob({
    user: account(),
    body: createJobBodySchema.parse(jobPayload),
    params: {},
    query: {},
  });
  assert.equal(result.statusCode, 201);
  assert.deepEqual(roleFilters, [{ scope: "staff", isActive: true }]);
  assert.deepEqual(staffFilters[0]?.role, { $in: [staffRoleId] });
  assert.equal(staffFilters[0]?.status, "active");
  assert.equal(staffFilters[0]?.isDeleted, false);
  assert.equal(String(saved[0]?.tenantId), String(clientOwner));
  assert.equal(saved[0]?.staffAssignments[0]?.hourRate, 22.5);
  assert.equal(saved[0]?.staffPayTotal, 67.5);
});

type JobRecordForTest = Pick<
  import("../types/models.js").JobRecord,
  "tenantId" | "staffAssignments" | "staffPayTotal"
>;

test("supervisors cannot assign accounts outside their active staff scope", async (context) => {
  const tenantId = new Types.ObjectId(actorId);
  const staffFilters: FilterQuery<UserRecord>[] = [];
  context.mock.method(Role, "find", () => ({
    select: () => ({ lean: async () => [{ _id: new Types.ObjectId(roleId) }] }),
  }));
  context.mock.method(Client, "findOne", () => ({
    select: async () => ({ _id: new Types.ObjectId(clientId), tenantId }),
  }));
  context.mock.method(User, "find", (filter: FilterQuery<UserRecord>) => {
    staffFilters.push(filter);
    return { select: async () => [] };
  });
  const create = context.mock.method(Job, "create", async () => {
    throw new Error("Must not save an invalid assignment");
  });
  const result = await addJob({
    user: account({
      scope: "tenant",
      isPlatformAdmin: false,
      tenantId: actorId,
    }),
    body: createJobBodySchema.parse(jobPayload),
    params: {},
    query: {},
  });
  assert.equal(result.statusCode, 400);
  assert.equal(staffFilters[0]?.tenantId, actorId);
  assert.equal(create.mock.callCount(), 0);
});

test("staff visibility follows assignments, including jobs owned by another account", async () => {
  const scope = await jobScope({
    user: account({
      scope: "staff",
      _id: staffId,
      id: staffId,
      tenantId: actorId,
    }),
  });
  assert.deepEqual(scope, {
    $or: [
      { assignedStaff: new Types.ObjectId(staffId) },
      { "staffAssignments.staff": new Types.ObjectId(staffId) },
    ],
  });
});

test("supervisors inherit jobs assigned to their staff", async (context) => {
  context.mock.method(Role, "find", () => ({
    select: () => ({ lean: async () => [{ _id: new Types.ObjectId(roleId) }] }),
  }));
  const received: FilterQuery<UserRecord>[] = [];
  context.mock.method(
    User,
    "distinct",
    async (_field: string, filter: FilterQuery<UserRecord>) => {
      received.push(filter);
      return [new Types.ObjectId(staffId)];
    },
  );
  const scope = await jobScope({
    user: account({
      scope: "tenant",
      tenantId: actorId,
      isPlatformAdmin: false,
    }),
  });
  assert.equal(String(received[0]?.tenantId), actorId);
  assert.deepEqual(scope, {
    $or: [
      { tenantId: new Types.ObjectId(actorId) },
      { assignedStaff: { $in: [new Types.ObjectId(staffId)] } },
      { "staffAssignments.staff": { $in: [new Types.ObjectId(staffId)] } },
    ],
  });
});
