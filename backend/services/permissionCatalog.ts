import type { RoleScope } from "../types/domain.js";
type PermissionDefinition = [key: string, name: string, group: string, platformOnly?: boolean];
interface RoleDefinition { key: string; name: string; description: string; scope: RoleScope; permissions: string[] }

export const permissionCatalog = [
  ["dashboard.view", "View dashboard", "Dashboard"],
  ["users.read", "View users", "Users"],
  ["users.create", "Create users", "Users"],
  ["users.update", "Update users", "Users"],
  ["users.delete", "Soft delete users", "Users"],
  ["users.restore", "Restore deleted users", "Users"],
  ["users.assignRole", "Assign roles to users", "Users"],
  ["users.status.update", "Change user account status", "Users"],
  ["users.password.reset", "Reset a user's password", "Users"],
  ["users.bank.read", "View user bank details", "Users"],
  ["users.bank.update", "Update user bank details", "Users"],
  ["users.tenant.assign", "Assign a staff account to a tenant supervisor", "Users", true],
  ["roles.read", "View roles and permissions", "Access control"],
  ["roles.manage", "Manage roles and permissions", "Access control", true],
  ["clients.read", "View clients", "Clients"],
  ["clients.create", "Create clients", "Clients"],
  ["clients.update", "Update clients", "Clients"],
  ["clients.delete", "Delete clients", "Clients"],
  ["clients.status.update", "Change client status", "Clients"],
  ["invoices.read", "View invoices", "Invoices"],
  ["invoices.create", "Create invoices", "Invoices"],
  ["invoices.update", "Update invoices", "Invoices"],
  ["invoices.delete", "Delete invoices", "Invoices"],
  ["invoices.status.update", "Change invoice status", "Invoices"],
  ["jobs.read", "View jobs", "Jobs"],
  ["jobs.create", "Create jobs", "Jobs"],
  ["jobs.update", "Update jobs", "Jobs"],
  ["jobs.delete", "Delete jobs", "Jobs"],
  ["jobs.count.read", "View job counts", "Jobs"],
  ["jobs.financials.read", "View job financial totals", "Jobs"],
  ["jobs.completed.read", "View completed jobs", "Jobs"],
  ["jobs.status.update", "Change job status", "Jobs"],
  ["jobs.invoice.read", "View job invoices", "Jobs"],
  ["jobs.attendance.sign", "Sign in and out of jobs", "Attendance"],
  ["jobs.assigned.read", "View staff job assignments", "Jobs"],
  ["timesheets.read", "View timesheets", "Attendance"],
  ["payroll.read", "View staff payroll", "Payroll"],
  ["payroll.self.read", "View own payment history", "Payroll"],
  ["payroll.record", "Record staff payroll", "Payroll"],
  ["staff.payout.record", "Record staff payouts", "Payroll"],
  ["clients.payment.record", "Record client payments", "Payments"],
  ["profile.read", "View own profile", "Profile"],
  ["profile.update", "Update own profile", "Profile"],
  ["auth.password.change", "Change own password", "Authentication"],
] satisfies PermissionDefinition[];

const allKeys = permissionCatalog.map(([key]) => key);

export const builtInRoles: RoleDefinition[] = [
  { key: "superadmin", name: "Super Admin", description: "Platform-wide administrator", scope: "platform", permissions: allKeys },
  {
    key: "admin", name: "Admin", description: "Tenant administrator", scope: "tenant",
    permissions: [
      "dashboard.view", "users.read", "users.create", "users.update", "users.delete", "users.restore",
      "users.status.update", "users.password.reset", "users.bank.read", "users.bank.update", "roles.read",
      "clients.read", "clients.create", "clients.update", "clients.delete", "clients.status.update",
      "invoices.read", "invoices.create", "invoices.update", "invoices.delete", "invoices.status.update",
      "jobs.read", "jobs.create", "jobs.update", "jobs.delete", "jobs.count.read", "jobs.financials.read",
      "jobs.completed.read", "jobs.status.update", "jobs.invoice.read", "jobs.attendance.sign", "jobs.assigned.read",
      "timesheets.read", "payroll.read", "payroll.self.read", "payroll.record", "staff.payout.record", "clients.payment.record",
      "profile.read", "profile.update", "auth.password.change",
    ],
  },
  {
    key: "staff", name: "Staff", description: "Staff member with access to assigned work", scope: "staff",
    permissions: ["jobs.read", "jobs.attendance.sign", "timesheets.read", "payroll.read", "payroll.self.read", "profile.read", "profile.update", "auth.password.change"],
  },
];
