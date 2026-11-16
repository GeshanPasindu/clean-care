import {
  clientSchema,
  jobSchema,
  roleSchema,
  sessionUserSchema,
  userSchema,
} from "../types/domain";
export const id = "507f1f77bcf86cd799439011";
export const employeeId = "507f1f77bcf86cd799439012";
export const roleId = "507f1f77bcf86cd799439013";
export const client = clientSchema.parse({
  _id: id,
  firstName: "Acme",
  lastName: "Cleaning",
  email: "acme@example.com",
  address: "Main street",
  phoneNumber: "0123456789",
  clientStatus: "active",
});
export const invitation = {
  url: `http://localhost:3000/first-login#token=${"A".repeat(43)}`,
  expiresAt: "2030-01-01T00:00:00.000Z",
};
export const role = roleSchema.parse({
  _id: roleId,
  key: "staff",
  name: "Staff",
  scope: "staff",
  isActive: true,
  isSystem: true,
});
export const staff = userSchema.parse({
  _id: employeeId,
  userName: "Test Staff",
  email: "staff@example.com",
  firstName: "Test",
  lastName: "Staff",
  scope: "staff",
  role: "staff",
  roleId,
  roleName: "Staff",
  isPlatformAdmin: false,
  status: "active",
  tenantId: id,
});
export const actor = sessionUserSchema.parse({
  ...staff,
  id: employeeId,
  scope: "platform",
  role: "superadmin",
  roleName: "Super Admin",
  isPlatformAdmin: true,
  permissions: [
    "users.create",
    "users.assignRole",
    "users.tenant.assign",
    "users.bank.update",
    "users.bank.read",
    "jobs.create",
    "jobs.financials.read",
  ],
});
export const secondStaff = userSchema.parse({
  ...staff,
  _id: "507f1f77bcf86cd799439015",
  firstName: "Senior",
  lastName: "Cleaner",
});
export const job = jobSchema.parse({
  _id: id,
  jobName: "Office cleaning",
  description: "Weekly cleaning",
  client,
  assignedStaff: [staff],
  staffAssignments: [
    {
      staff,
      estimatedHours: 3,
      estimatedPayment: 60,
      hourRate: 20,
      hours: 3,
      payment: 60,
    },
  ],
  jobStatus: "InProgress",
  orgNoOfhours: 4,
  orgHourRate: 30,
  orgTotal: 120,
  estNoOfhours: 3,

  staffPayTotal: 60,
  jobDate: "2026-11-13T06:27:00.000Z",
});
export const paginationInfo = {
  totalResult: 1,
  totalPages: 1,
  currentPage: 1,
  pageSize: 25,
};
