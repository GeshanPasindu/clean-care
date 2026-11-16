import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { Types, type FilterQuery, type PipelineStage } from "mongoose";
import EmployeePayment from "../models/employeePaymentModel.js";
import SalaryPlan from "../models/salaryPlanModel.js";
import StaffPayroll from "../models/staffPayrollModel.js";
import Job from "../models/jobModel.js";
import User from "../models/userModel.js";
import Role from "../models/roleModel.js";
import type { EmployeePaymentRecord } from "../types/payments.js";
import { employeePaymentService as service } from "../services/employeePaymentService.js";
import { assertPaymentAccess } from "../services/paymentAccessService.js";
import { builtInRoles } from "../services/permissionCatalog.js";
import { paymentPeriod, paymentDay } from "../utils/paymentPeriods.js";
import {
  preparePaymentSchema,
  salaryPlanSchema,
  markPaidSchema,
} from "../validation/payments.js";
import { account, actorId, staffId, roleId, clientId } from "./fixtures.js";
import express from "express";
import { prepare as prepareController } from "../controllers/employeePaymentController.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { serve } from "./http.js";
import type { PreparePaymentInput } from "../types/requests.js";
import { paymentListSchema } from "../validation/payments.js";
import { updatedJob, deleteJobById } from "../services/jobService.js";

const paymentId = "507f1f77bcf86cd799439088";
const jobId = "507f1f77bcf86cd799439099";
const manager = account({
  permissions: [
    "payroll.read",
    "payroll.record",
    "salaries.read",
    "salaries.manage",
    "salaries.record",
  ],
});
const input = preparePaymentSchema.parse({
  employeeId: staffId,
  frequency: "Daily",
  date: "2026-11-14",
});
const paidInput = markPaidSchema.parse({
  paymentDate: "2026-11-14",
  method: "Bank Transfer",
  referenceNumber: "TX-123",
});

function mockWork(context: TestContext, scope: "staff" | "tenant" = "staff") {
  const employee = {
    ...new User({
      _id: staffId,
      userName: "Cleaner",
      firstName: "Test",
      lastName: "Worker",
      email: "worker@example.com",
      role: roleId,
      tenantId: actorId,
    }).toObject(),
    role: new Role({ _id: roleId, scope, isActive: true }).toObject(),
  };
  const job = new Job({
    _id: jobId,
    tenantId: actorId,
    jobName: "Office cleaning",
    client: clientId,
    jobStatus: "Completed",
    assignedStaff: [staffId],
    staffAssignments: [
      {
        staff: staffId,
        hourRate: 20,
        payment: 40,
        hours: 2,
        timeEntries: [
          {
            signInTime: new Date("2026-11-13T19:00:00Z"),
            signOffTime: new Date("2026-11-13T21:00:00Z"),
            hours: 2,
            hourRate: 20,
          },
        ],
      },
    ],
  });
  let stored: InstanceType<typeof EmployeePayment> | undefined;
  context.mock.method(User, "findOne", () => ({
    select: () => ({ populate: async () => employee }),
  }));
  context.mock.method(Job, "find", () => ({ select: async () => [job] }));
  context.mock.method(Job, "findOne", () => ({ select: async () => job }));
  context.mock.method(Job, "findById", async () => job);
  context.mock.method(job, "save", async () => job);
  context.mock.method(StaffPayroll, "find", () => ({
    select: () => ({ lean: async () => [] }),
  }));
  context.mock.method(
    EmployeePayment,
    "find",
    (filter: FilterQuery<EmployeePaymentRecord>) => ({
      select: () => ({
        lean: async () => (stored && !filter._id ? [stored] : []),
      }),
    }),
  );
  context.mock.method(EmployeePayment, "init", async () => EmployeePayment);
  context.mock.method(EmployeePayment, "updateOne", async () => ({
    acknowledged: true,
    matchedCount: 1,
    modifiedCount: 1,
  }));
  context.mock.method(
    EmployeePayment,
    "create",
    async (data: Partial<EmployeePaymentRecord>) => {
      stored = new EmployeePayment({ ...data, _id: paymentId });
      return stored;
    },
  );
  context.mock.method(EmployeePayment, "findById", async () => stored);
  return { employee, job, getStored: () => stored };
}

test("daily, weekly and monthly boundaries use Colombo dates", () => {
  const daily = paymentPeriod("2026-11-14", "Daily");
  assert.equal(daily.periodStart.toISOString(), "2026-11-13T18:30:00.000Z");
  assert.equal(daily.periodEnd.toISOString(), "2026-11-14T18:29:59.999Z");
  const week = paymentPeriod("2026-11-15", "Weekly");
  assert.equal(paymentDay(week.periodStart), "2026-11-09");
  assert.equal(paymentDay(week.periodEnd), "2026-11-15");
  const month = paymentPeriod("2028-02-29", "Monthly");
  assert.equal(paymentDay(month.periodStart), "2028-02-01");
  assert.equal(paymentDay(month.periodEnd), "2028-02-29");
});

test("payment DTOs validate modes, job IDs, salary frequency and payment details", () => {
  for (const frequency of ["Daily", "Weekly", "Monthly"])
    assert.ok(preparePaymentSchema.safeParse({ ...input, frequency }).success);
  assert.equal(
    preparePaymentSchema.safeParse({ ...input, frequency: "PerJob" }).success,
    false,
  );
  assert.equal(
    preparePaymentSchema.safeParse({ ...input, jobId }).success,
    false,
  );
  assert.ok(
    preparePaymentSchema.safeParse({ ...input, frequency: "PerJob", jobId })
      .success,
  );
  assert.equal(
    preparePaymentSchema.safeParse({ ...input, date: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    salaryPlanSchema.safeParse({
      amount: 100,
      frequency: "Daily",
      effectiveFrom: input.date,
    }).success,
    false,
  );
  assert.equal(
    salaryPlanSchema.safeParse({
      amount: 0,
      frequency: "Monthly",
      effectiveFrom: input.date,
    }).success,
    false,
  );
  assert.equal(
    markPaidSchema.safeParse({ ...paidInput, method: "unknown" }).success,
    false,
  );
  assert.equal(
    "amount" in preparePaymentSchema.parse({ ...input, amount: 99999 }),
    false,
  );
});

test("supervisors can manage their cleaners, while salary permissions are separate", () => {
  const supervisor = account({
    scope: "tenant",
    permissions: ["payroll.read", "payroll.record"],
  });
  const target = { _id: staffId, scope: "staff" as const, tenantId: actorId };
  assert.doesNotThrow(() => assertPaymentAccess(supervisor, target, "record"));
  assert.throws(
    () =>
      assertPaymentAccess(
        supervisor,
        { ...target, tenantId: roleId },
        "record",
      ),
    /Employee not found/,
  );
  assert.throws(
    () =>
      assertPaymentAccess(supervisor, { ...target, scope: "tenant" }, "record"),
    /Access denied/,
  );
  assert.throws(
    () =>
      assertPaymentAccess(
        manager,
        { ...target, _id: actorId, scope: "tenant" },
        "record",
      ),
    /own payments/,
  );
  assert.throws(
    () =>
      assertPaymentAccess(
        account({ scope: "staff", permissions: manager.permissions }),
        target,
        "record",
      ),
    /own payments/,
  );
  assert.throws(
    () =>
      assertPaymentAccess(manager, { ...target, scope: "platform" }, "read"),
    /Platform accounts/,
  );
  assert.ok(
    builtInRoles
      .find((role) => role.key === "superadmin")
      ?.permissions.includes("salaries.record"),
  );
  assert.ok(
    !builtInRoles
      .find((role) => role.key === "admin")
      ?.permissions.includes("salaries.record"),
  );
  assert.ok(
    !builtInRoles
      .find((role) => role.key === "superadmin")
      ?.permissions.includes("payroll.self.read"),
  );
});

test("daily preparation uses completed shift pay and reserves it across all frequencies", async (context) => {
  const { getStored } = mockWork(context);
  const result = await service.prepare(input, manager);
  assert.equal(result.payment.amount, 40);
  assert.equal(result.payment.status, "Pending");
  assert.equal(result.payment.receiptNumber, undefined);
  assert.deepEqual(getStored()?.workKeys, [`${staffId}:${jobId}:0`]);
  await assert.rejects(
    service.prepare({ ...input, frequency: "Weekly" }, manager),
    /No unpaid completed work/,
  );
  await assert.rejects(
    service.prepare({ ...input, frequency: "PerJob", jobId }, manager),
    /No unpaid completed work/,
  );
  assert.ok(
    EmployeePayment.schema
      .indexes()
      .some(
        ([fields, options]) => fields.workKeys === 1 && options.unique === true,
      ),
  );
});

test("per-job payouts require a completed assigned job and use actual shift dates", async (context) => {
  mockWork(context);
  const result = await service.prepare(
    { ...input, frequency: "PerJob", jobId },
    manager,
  );
  assert.equal(result.payment.frequency, "PerJob");
  assert.equal(result.payment.jobId, jobId);
  assert.equal(result.payment.periodStart, "2026-11-14");
  context.mock.method(Job, "findOne", () => ({ select: async () => null }));
  await assert.rejects(
    service.preview(
      { ...input, frequency: "PerJob", jobId: clientId },
      manager,
    ),
    /completed job assigned/,
  );
});

test("a duplicate work reservation becomes a conflict rather than a second payment", async (context) => {
  mockWork(context);
  context.mock.method(EmployeePayment, "create", async () => {
    throw Object.assign(new Error("duplicate"), { code: 11000 });
  });
  await assert.rejects(
    service.prepare(input, manager),
    /already has a pending or paid payment/,
  );
});

test("mark paid checks current work then atomically issues an immutable receipt", async (context) => {
  const { getStored } = mockWork(context);
  await service.prepare(input, manager);
  const stored = getStored();
  assert.ok(stored);
  let writes = 0;
  context.mock.method(
    EmployeePayment,
    "findOneAndUpdate",
    async (
      filter: FilterQuery<EmployeePaymentRecord>,
      update: { $set: Partial<EmployeePaymentRecord> },
    ) => {
      assert.equal(filter.status, "Pending");
      writes++;
      Object.assign(stored, update.$set);
      return stored;
    },
  );
  const result = await service.markPaid(paymentId, paidInput, manager);
  assert.equal(result.payment.status, "Paid");
  assert.equal(
    result.payment.receiptNumber,
    `CC-PAY-${paymentId.toUpperCase()}`,
  );
  assert.equal(result.payment.referenceNumber, "TX-123");
  assert.equal(result.syncPending, false);
  const retry = await service.markPaid(paymentId, paidInput, manager);
  assert.equal(retry.payment.receiptNumber, result.payment.receiptNumber);
  assert.equal(writes, 1);
  context.mock.method(
    EmployeePayment,
    "deleteOne",
    async (filter: FilterQuery<EmployeePaymentRecord>) => {
      assert.equal(filter.status, "Pending");
      return { deletedCount: 0 };
    },
  );
  await assert.rejects(
    service.cancel(paymentId, manager),
    /Paid receipts cannot/,
  );
});

test("changed work cannot be marked paid using a stale prepared amount", async (context) => {
  const { job } = mockWork(context);
  await service.prepare(input, manager);
  const shift = job.staffAssignments[0]?.timeEntries[0];
  assert.ok(shift);
  shift.hourRate = 25;
  await assert.rejects(
    service.markPaid(paymentId, paidInput, manager),
    /Work details changed/,
  );
});

test("failed job updates remain retryable without changing or recording the payment again", async (context) => {
  const { job, getStored } = mockWork(context);
  await service.prepare(input, manager);
  const stored = getStored();
  assert.ok(stored);
  let paidWrites = 0;
  context.mock.method(
    EmployeePayment,
    "findOneAndUpdate",
    async (
      _filter: FilterQuery<EmployeePaymentRecord>,
      update: { $set: Partial<EmployeePaymentRecord> },
    ) => {
      paidWrites++;
      Object.assign(stored, update.$set);
      return stored;
    },
  );
  const retryFlags: boolean[] = [];
  context.mock.method(
    EmployeePayment,
    "updateOne",
    async (
      filter: FilterQuery<EmployeePaymentRecord>,
      update: { $set: { jobTotalsPending: boolean } },
      options: { timestamps: boolean },
    ) => {
      assert.equal(filter.status, "Paid");
      assert.equal(options.timestamps, false);
      assert.deepEqual(Object.keys(update.$set), ["jobTotalsPending"]);
      retryFlags.push(update.$set.jobTotalsPending);
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    },
  );
  context.mock.method(job, "save", async () => {
    throw new Error("Job write failed");
  });
  const paid = await service.markPaid(paymentId, paidInput, manager);
  assert.equal(paid.payment.status, "Paid");
  assert.equal(paid.syncPending, true);
  assert.equal(paid.payment.jobTotalsPending, true);
  context.mock.method(job, "save", async () => job);
  const retried = await service.synchronize(paymentId, manager);
  assert.equal(retried.syncPending, false);
  assert.equal(retried.payment.jobTotalsPending, false);
  assert.equal(retried.payment.receiptNumber, paid.payment.receiptNumber);
  assert.equal(retried.payment.amount, paid.payment.amount);
  assert.equal(retried.payment.paymentDate, paid.payment.paymentDate);
  assert.equal(paidWrites, 1);
  assert.deepEqual(retryFlags, [true, false]);
});

test("job-total retries require a paid record and the same employee payment permissions", async (context) => {
  const { getStored } = mockWork(context);
  await service.prepare(input, manager);
  await assert.rejects(
    service.synchronize(paymentId, manager),
    /Only paid payments/,
  );
  const stored = getStored();
  assert.ok(stored);
  stored.status = "Paid";
  await assert.rejects(
    service.synchronize(
      paymentId,
      account({
        scope: "tenant",
        tenantId: roleId,
        permissions: ["payroll.record"],
      }),
    ),
    /Employee not found/,
  );
  await assert.rejects(
    service.synchronize(
      paymentId,
      account({ scope: "staff", permissions: ["payroll.record"] }),
    ),
    /own payments/,
  );
});

test("paid receipts stay recorded if saving the retry indicator fails", async (context) => {
  const { getStored } = mockWork(context);
  await service.prepare(input, manager);
  const stored = getStored();
  assert.ok(stored);
  context.mock.method(
    EmployeePayment,
    "findOneAndUpdate",
    async (
      _filter: FilterQuery<EmployeePaymentRecord>,
      update: { $set: Partial<EmployeePaymentRecord> },
    ) => {
      Object.assign(stored, update.$set);
      return stored;
    },
  );
  context.mock.method(EmployeePayment, "updateOne", async () => {
    throw new Error("Metadata write failed");
  });
  const result = await service.markPaid(paymentId, paidInput, manager);
  assert.equal(result.payment.status, "Paid");
  assert.equal(result.syncPending, true);
  assert.equal(result.payment.jobTotalsPending, true);
  assert.ok(result.payment.receiptNumber);
  assert.equal(stored.amount, 40);
});

test("salary amounts come from the plan and overlapping weekly/monthly periods are reserved", async (context) => {
  const { getStored } = mockWork(context, "tenant");
  context.mock.method(SalaryPlan, "findOne", () => ({
    lean: async () => ({
      amount: 1200,
      frequency: "Monthly",
      effectiveFrom: paymentPeriod("2026-11-01", "Daily").periodStart,
    }),
  }));
  context.mock.method(EmployeePayment, "exists", async () => null);
  const result = await service.prepare(
    { ...input, frequency: "Monthly" },
    manager,
  );
  assert.equal(result.payment.amount, 1200);
  assert.equal(result.payment.kind, "Salary");
  assert.equal(getStored()?.workKeys?.length, 30);
  assert.equal(getStored()?.workKeys?.[0], `salary:${staffId}:2026-11-01`);
  await assert.rejects(
    service.preview({ ...input, frequency: "Weekly" }, manager),
    /monthly salary/,
  );
  context.mock.method(EmployeePayment, "exists", async () => ({
    _id: new Types.ObjectId(paymentId),
  }));
  await assert.rejects(
    service.preview({ ...input, frequency: "Monthly" }, manager),
    /overlaps/,
  );
  context.mock.method(EmployeePayment, "exists", async () => null);
  context.mock.method(SalaryPlan, "findOne", () => ({
    lean: async () => ({
      amount: 1200,
      frequency: "Monthly",
      effectiveFrom: paymentPeriod("2026-11-15", "Daily").periodStart,
    }),
  }));
  await assert.rejects(
    service.preview({ ...input, frequency: "Monthly" }, manager),
    /full salary period/,
  );
});

test("personal receipt queries always bind to the authenticated account and paid status", async (context) => {
  const pipelines: PipelineStage[][] = [];
  context.mock.method(EmployeePayment, "countDocuments", async () => 0);
  context.mock.method(StaffPayroll, "countDocuments", async () => 0);
  context.mock.method(
    EmployeePayment,
    "aggregate",
    async (pipeline: PipelineStage[]) => {
      pipelines.push(pipeline);
      return [];
    },
  );
  const employee = account({
    _id: staffId,
    id: staffId,
    scope: "staff",
    permissions: ["payroll.self.read"],
  });
  const result = await service.receipts(employee, { page: 2, limit: 20 });
  assert.equal(result.paginationInfo.currentPage, 2);
  assert.deepEqual(pipelines[0]?.[0], {
    $match: { employee: new Types.ObjectId(staffId), status: "Paid" },
  });
  await assert.rejects(
    service.receipts(account({ permissions: ["payroll.self.read"] }), {
      page: 1,
      limit: 20,
    }),
    /not available/,
  );
});

test("payment controllers reject invalid inputs and strip client-supplied amount/status", async (context) => {
  const received: PreparePaymentInput[] = [];
  context.mock.method(service, "prepare", async (body: PreparePaymentInput) => {
    received.push(body);
    return { payment: {} };
  });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = manager;
    next();
  });
  app.post("/payments", prepareController);
  app.use(errorHandler);
  const endpoint = await serve(app);
  try {
    const bad = await fetch(`${endpoint.url}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, frequency: "PerJob" }),
    });
    assert.equal(bad.status, 400);
    assert.equal(received.length, 0);
    const good = await fetch(`${endpoint.url}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, amount: 99999, status: "Paid" }),
    });
    assert.equal(good.status, 201);
    assert.deepEqual(received, [input]);
  } finally {
    await endpoint.close();
  }
});

test("manager payment history includes old paid receipts under the same tenant boundary", async (context) => {
  let captured: PipelineStage[] = [];
  context.mock.method(
    EmployeePayment,
    "aggregate",
    async (pipeline: PipelineStage[]) => {
      captured = pipeline;
      return [{ payments: [], total: [{ count: 3 }] }];
    },
  );
  const supervisor = account({
    scope: "tenant",
    permissions: ["payroll.read"],
  });
  const result = await service.list(
    paymentListSchema.parse({
      scope: "staff",
      status: "Paid",
      page: 1,
      limit: 20,
    }),
    supervisor,
  );
  assert.equal(result.paginationInfo.totalResult, 3);
  assert.deepEqual(captured[0], {
    $match: {
      employeeScope: "staff",
      employee: { $ne: new Types.ObjectId(actorId) },
      tenantId: new Types.ObjectId(actorId),
      status: "Paid",
    },
  });
  assert.ok(captured.some((stage) => "$unionWith" in stage));
});

test("payment ledger protects paid rates even when a job projection has not synchronized", async (context) => {
  const { job } = mockWork(context);
  context.mock.method(Job, "findOne", async () => job);
  context.mock.method(EmployeePayment, "exists", async () => ({
    _id: new Types.ObjectId(paymentId),
  }));
  const result = await updatedJob({
    user: manager,
    params: { id: jobId },
    query: {},
    body: { staffRates: { [staffId]: 25 } },
  });
  assert.equal(result.statusCode, 409);
});

test("a reserved or paid employee payment prevents deletion of its source job", async (context) => {
  context.mock.method(StaffPayroll, "exists", async () => null);
  context.mock.method(EmployeePayment, "exists", async () => ({
    _id: new Types.ObjectId(paymentId),
  }));
  let deletes = 0;
  context.mock.method(Job, "findOneAndDelete", async () => {
    deletes++;
    return null;
  });
  const result = await deleteJobById({
    user: manager,
    params: { id: jobId },
    query: {},
    body: {},
  });
  assert.equal(result.statusCode, 409);
  assert.equal(deletes, 0);
});
