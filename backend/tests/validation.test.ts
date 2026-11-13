import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { loginBodySchema } from "../validation/auth.js";
import { createClientBodySchema } from "../validation/client.js";
import {
  createInvoiceBodySchema,
  invoiceListQuerySchema,
} from "../validation/invoice.js";
import {
  createUserBodySchema,
  updateUserBodySchema,
  changeRoleBodySchema,
  userStatusBodySchema,
} from "../validation/user.js";
import {
  createRoleBodySchema,
  updateRoleBodySchema,
} from "../validation/role.js";
import {
  createJobBodySchema,
  updateJobBodySchema,
  jobListQuerySchema,
  timesheetQuerySchema,
  payrollQuerySchema,
  payrollBodySchema,
  signOffBodySchema,
  clientJobQuerySchema,
} from "../validation/job.js";
import {
  idParamsSchema,
  paginationQuerySchema,
  paymentBodySchema,
  requestSchema,
  emptySchema,
} from "../validation/common.js";
import {
  jobPayload,
  userPayload,
  staffId,
  roleId,
  clientId,
} from "./fixtures.js";

test("job form values become a consistent service DTO", () => {
  const parsed = createJobBodySchema.parse(jobPayload);
  assert.equal(parsed.orgNoOfhours, 4);
  assert.equal(parsed.staffRates?.[staffId], 22.5);
  assert.ok(parsed.jobDate instanceof Date);
  assert.equal(parsed.jobDate.getFullYear(), 2026);
  assert.equal(parsed.jobDate.getMonth(), 10);
});

test("invalid assignment IDs, duplicate staff, rates, and dates are rejected", () => {
  for (const change of [
    { assignedStaff: [] },
    { assignedStaff: [staffId, staffId] },
    { assignedStaff: ["invalid"] },
    { orgHourRate: -1 },
    { orgHourRate: true },
    { orgNoOfhours: "" },
    { staffRates: { [staffId]: "Infinity" } },
    { staffRates: { invalid: "20" } },
    { staffRates: { [roleId]: "20" } },
    { jobDate: false },
    { jobDate: 1 },
    { jobDate: "2026-02-30" },
  ])
    assert.equal(
      createJobBodySchema.safeParse({ ...jobPayload, ...change }).success,
      false,
      JSON.stringify(change),
    );
});

test("user form dates, optional supervisor, and email are normalized", () => {
  const parsed = createUserBodySchema.parse(userPayload);
  assert.equal(parsed.email, "employee@example.com");
  assert.equal(parsed.dateOfBirth, null);
  assert.ok(parsed.dateOfHire instanceof Date);
  assert.equal(parsed.bankAcNo, "0012345");
  assert.equal(
    createUserBodySchema.parse({ ...userPayload, roleId: "", tenantId: "" })
      .roleId,
    undefined,
  );
  assert.equal(
    createUserBodySchema.safeParse({ ...userPayload, dateOfBirth: true })
      .success,
    false,
  );
  assert.equal(
    createUserBodySchema.safeParse({ ...userPayload, password: "short" })
      .success,
    false,
  );
});

test("role and supervisor changes use the dedicated payload", () => {
  assert.equal(updateUserBodySchema.safeParse({ roleId }).success, false);
  assert.equal(
    updateUserBodySchema.safeParse({ tenantId: staffId }).success,
    false,
  );
  assert.deepEqual(changeRoleBodySchema.parse({ roleId, tenantId: staffId }), {
    roleId,
    tenantId: staffId,
  });
  assert.equal(
    userStatusBodySchema.safeParse({ status: "admin" }).success,
    false,
  );
});

test("server-managed fields are stripped from updates", () => {
  assert.deepEqual(
    updateJobBodySchema.parse({
      jobStatus: "Completed",
      tenantId: staffId,
      payment: 5000,
    }),
    {},
  );
  assert.deepEqual(
    updateUserBodySchema.parse({
      password: "cannot-change-here",
      isDeleted: true,
      permissions: ["users.create"],
    }),
    {},
  );
});

test("pagination only accepts bounded integer values", () => {
  assert.deepEqual(paginationQuerySchema.parse({ page: "2", limit: "50" }), {
    page: 2,
    limit: 50,
    search: "",
  });
  for (const query of [
    { page: "0" },
    { page: "1.5" },
    { page: "9007199254740992" },
    { limit: "101" },
    { page: true },
    { page: ["1", "2"] },
    { search: { $ne: "" } },
  ]) {
    assert.equal(paginationQuerySchema.safeParse(query).success, false);
  }
});

test("job and invoice date ranges are complete and ordered", () => {
  for (const schema of [jobListQuerySchema, invoiceListQuerySchema]) {
    for (const query of [
      { startDate: "2026-11-13" },
      { startDate: "2026-11-13", endDate: "2026-11-01" },
      { startDate: "2026-02-30", endDate: "2026-03-01" },
    ]) {
      assert.equal(schema.safeParse(query).success, false);
    }
    assert.equal(
      schema.safeParse({ startDate: "2026-11-01", endDate: "2026-11-13" })
        .success,
      true,
    );
  }
  assert.equal(
    timesheetQuerySchema.safeParse({ startDate: "2026-11-01", limit: "200" })
      .success,
    true,
  );
  assert.equal(timesheetQuerySchema.safeParse({ limit: "201" }).success, false);
  assert.equal(
    clientJobQuerySchema.safeParse({ minPayment: 100, maxPayment: 10 }).success,
    false,
  );
});

test("payroll and payment payloads reject invalid periods and values", () => {
  const payment = {
    paymentDate: "2026-11-13",
    method: "Bank Transfer",
    referenceNumber: " TEST ",
  };
  assert.equal(
    paymentBodySchema.parse({ ...payment, amount: "50.25" }).amount,
    50.25,
  );
  for (const amount of [0, -1, true, "NaN", "Infinity"])
    assert.equal(
      paymentBodySchema.safeParse({ ...payment, amount }).success,
      false,
    );
  assert.equal(
    payrollBodySchema.safeParse({
      ...payment,
      periodStart: "2026-11-13",
      periodEnd: "2026-11-01",
    }).success,
    false,
  );
  assert.equal(
    payrollBodySchema.safeParse({
      ...payment,
      periodStart: "2024-01-01",
      periodEnd: "2026-01-01",
    }).success,
    false,
  );
  assert.equal(
    payrollQuerySchema.safeParse({ startDate: "2026-11-13" }).success,
    false,
  );
  assert.equal(payrollQuerySchema.safeParse({}).success, true);
});

test("login, attendance, client, invoice, and role inputs validate their contracts", () => {
  assert.equal(
    loginBodySchema.parse({
      email: " ADMIN@example.com ",
      password: "password",
    }).email,
    "admin@example.com",
  );
  assert.equal(
    loginBodySchema.safeParse({ email: { $ne: null }, password: "password" })
      .success,
    false,
  );
  assert.equal(
    signOffBodySchema.safeParse({ description: "   " }).success,
    false,
  );
  assert.equal(
    createClientBodySchema.safeParse({ email: "bad" }).success,
    false,
  );
  assert.equal(
    createInvoiceBodySchema.safeParse({
      invoiceTitle: "Invoice",
      invoiceDescription: "Cleaning",
      client: clientId,
      amount: -10,
    }).success,
    false,
  );
  assert.equal(
    createRoleBodySchema.safeParse({ name: "Platform", scope: "platform" })
      .success,
    false,
  );
  assert.equal(
    updateRoleBodySchema.safeParse({ isActive: "false" }).success,
    false,
  );
  assert.deepEqual(
    createRoleBodySchema.parse({
      name: "Supervisor",
      scope: "tenant",
      permissionKeys: ["users.assignRole"],
    }).permissionKeys,
    ["users.assignRole"],
  );
});

test("route IDs are validated and GET requests support an absent body", () => {
  assert.equal(idParamsSchema.safeParse({ id: "invalid" }).success, false);
  const schema = requestSchema(
    emptySchema,
    idParamsSchema,
    paginationQuerySchema,
  );
  assert.deepEqual(
    schema.parse({ body: undefined, params: { id: staffId }, query: {} }).body,
    {},
  );
  assert.throws(
    () => schema.parse({ body: {}, params: { id: "bad" }, query: {} }),
    z.ZodError,
  );
});
