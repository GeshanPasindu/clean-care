import type { AuthenticatedUser } from "../types/domain.js";

export const actorId = "507f1f77bcf86cd799439011";
export const staffId = "507f1f77bcf86cd799439012";
export const roleId = "507f1f77bcf86cd799439013";
export const clientId = "507f1f77bcf86cd799439014";

export function account(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    id: actorId,
    _id: actorId,
    userName: "Test Admin",
    email: "admin@example.com",
    role: "superadmin",
    roleId,
    roleName: "Super Admin",
    scope: "platform",
    isPlatformAdmin: true,
    permissions: ["users.create", "users.assignRole", "jobs.create"],
    status: "active",
    firstName: "Test",
    lastName: "Admin",
    address: "",
    phoneNumber: "",
    dateOfBirth: null,
    position: "",
    tenantId: null,
    supervisor: null,
    supervisorName: "",
    isDeleted: false,
    ...overrides,
  };
}

export const jobPayload = {
  jobName: "Office cleaning",
  description: "Weekly cleaning",
  client: clientId,
  assignedStaff: [staffId],
  orgNoOfhours: "4",
  orgHourRate: "30",
  estNoOfhours: "3",

  staffRates: { [staffId]: "22.50" },
  jobDate: "2026-11-13T11:57",
  notes: "",
};

export const userPayload = {
  userName: "New employee",
  email: "EMPLOYEE@example.com",
  password: "a-valid-initial-password",
  roleId,
  tenantId: actorId,
  firstName: "New",
  lastName: "Employee",
  dateOfBirth: "",
  dateOfHire: "2026-11-13",
  bankAcNo: "0012345",
  payFrequency: "Weekly",
};
