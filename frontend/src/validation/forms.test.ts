import { describe, expect, it } from "vitest";
import { employeeId, id, roleId } from "../test/fixtures";
import {
  accountFormSchema,
  changePasswordSchema,
  clientDefaults,
  clientFormSchema,
  dateRangeSchema,
  invoiceDefaults,
  invoiceFormSchema,
  jobDefaults,
  jobFormSchema,
  loginSchema,
  paymentFormSchema,
  payrollFormSchema,
  roleFormSchema,
  userDefaults,
  workDescriptionSchema,
} from "./forms";

describe("form contracts", () => {
  it("normalizes emails while preserving password characters", () => {
    expect(
      loginSchema.parse({
        email: " ADMIN@example.com ",
        password: "  password  ",
      }),
    ).toEqual({ email: "admin@example.com", password: "  password  " });
    expect(
      loginSchema.safeParse({ email: "invalid", password: "" }).success,
    ).toBe(false);
  });
  it("validates client identity and optional contact email", () => {
    expect(clientFormSchema.safeParse(clientDefaults).success).toBe(false);
    const valid = {
      ...clientDefaults,
      firstName: " Client ",
      lastName: "Record",
      email: "client@example.com",
      address: "Street",
      phoneNumber: "0123",
    };
    expect(clientFormSchema.parse(valid).firstName).toBe("Client");
    expect(clientFormSchema.parse({ ...valid, lastName: "" }).lastName).toBe(
      "",
    );
    expect(
      clientFormSchema.safeParse({ ...valid, contactEmail: "bad" }).success,
    ).toBe(false);
  });
  it("requires staff assignments and converts rates without accepting empty, negative, or boolean numbers", () => {
    const payload = {
      ...jobDefaults,
      jobName: "Clean",
      description: "Weekly",
      client: id,
      assignedStaff: [employeeId],
      staffRates: { [employeeId]: "20.5" },
      orgNoOfhours: "4",
      orgHourRate: "30",
      estNoOfhours: "3",
    };
    expect(jobFormSchema.parse(payload).staffRates[employeeId]).toBe(20.5);
    for (const changes of [
      { assignedStaff: [] },
      { assignedStaff: [employeeId, employeeId] },
      { staffRates: { [employeeId]: "" } },
      { staffRates: { [employeeId]: true } },
      { staffRates: { [employeeId]: -2 } },
      { staffRates: {} },
      { staffRates: { [roleId]: "10" } },
      { jobDate: "2026-02-30" },
    ]) {
      expect(jobFormSchema.safeParse({ ...payload, ...changes }).success).toBe(
        false,
      );
    }
  });
  it("validates invoice amounts and real calendar dates", () => {
    const payload = {
      ...invoiceDefaults,
      invoiceTitle: "Invoice",
      invoiceDescription: "Cleaning",
      client: id,
      amount: "50",
      sendDate: "2026-11-13",
    };
    expect(invoiceFormSchema.parse(payload).amount).toBe(50);
    expect(
      invoiceFormSchema.safeParse({ ...payload, sendDate: "2026-02-30" })
        .success,
    ).toBe(false);
    expect(
      invoiceFormSchema.safeParse({ ...payload, amount: -1 }).success,
    ).toBe(false);
  });
  it("enforces account creation rules for superadmins, supervisors, and edits", () => {
    const values = {
      ...userDefaults,
      userName: "Staff",
      email: "staff@example.com",
      password: "valid-initial-password",
    };
    const platform = accountFormSchema({
      editing: false,
      chooseRole: true,
      needsSupervisor: () => true,
    });
    expect(platform.safeParse(values).success).toBe(false);
    expect(
      platform.safeParse({ ...values, roleId, tenantId: id }).success,
    ).toBe(true);
    const supervisor = accountFormSchema({
      editing: false,
      chooseRole: false,
      needsSupervisor: () => false,
    });
    expect(supervisor.safeParse(values).success).toBe(true);
    expect(supervisor.safeParse({ ...values, password: "short" }).success).toBe(
      false,
    );
    const edit = accountFormSchema({
      editing: true,
      chooseRole: false,
      needsSupervisor: () => false,
    });
    expect(edit.safeParse({ ...values, password: "" }).success).toBe(true);
    expect(
      edit.safeParse({ ...values, dateOfBirth: "2026-02-30" }).success,
    ).toBe(false);
  });
  it("checks password confirmation and role scopes", () => {
    const password = {
      currentPassword: " old password ",
      newPassword: "new-password-123",
      confirmPassword: "new-password-123",
    };
    expect(changePasswordSchema.parse(password).currentPassword).toBe(
      " old password ",
    );
    expect(
      changePasswordSchema.safeParse({
        ...password,
        confirmPassword: "different",
      }).success,
    ).toBe(false);
    expect(
      roleFormSchema.safeParse({
        name: "Role",
        description: "",
        scope: "platform",
        permissionKeys: [],
        isActive: true,
      }).success,
    ).toBe(false);
  });
  it("validates payment, payroll, filters, and work descriptions", () => {
    const payment = {
      amount: "12.5",
      paymentDate: "2026-11-13",
      method: "Cash",
      referenceNumber: " TEST ",
    };
    expect(paymentFormSchema.parse(payment)).toMatchObject({
      amount: 12.5,
      referenceNumber: "TEST",
    });
    expect(paymentFormSchema.safeParse({ ...payment, amount: 0 }).success).toBe(
      false,
    );
    expect(
      payrollFormSchema.safeParse({
        ...payment,
        periodStart: "2026-11-13",
        periodEnd: "2026-11-01",
      }).success,
    ).toBe(false);
    expect(
      payrollFormSchema.safeParse({
        ...payment,
        periodStart: "2024-01-01",
        periodEnd: "2026-11-01",
      }).success,
    ).toBe(false);
    expect(
      dateRangeSchema.safeParse({ startDate: "2026-11-13", endDate: "" })
        .success,
    ).toBe(false);
    expect(workDescriptionSchema.safeParse({ description: " " }).success).toBe(
      false,
    );
  });
});
