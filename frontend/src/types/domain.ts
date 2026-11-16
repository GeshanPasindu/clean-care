import { z } from "zod";

export const roleScopeSchema = z.enum(["platform", "tenant", "staff"]);
export const accountStatusSchema = z.enum(["active", "inactive"]);
export const jobStatusSchema = z.enum(["InProgress", "Completed", "Cancelled"]);
export const paymentStatusSchema = z.enum(["Pending", "Done"]);
export const paymentMethodSchema = z.enum([
  "Cash",
  "Bank Transfer",
  "Card",
  "Cheque",
  "Other",
]);
export const payFrequencySchema = z.enum([
  "Daily",
  "PerJob",
  "Weekly",
  "Monthly",
]);
export type RoleScope = z.infer<typeof roleScopeSchema>;
export type AccountStatus = z.infer<typeof accountStatusSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export const entitySchema = z.object({
  _id: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export const identitySchema = z.object({
  _id: z.string(),
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  userName: z.string().optional(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
});
// Populated refs are normalized so views can safely render IDs and partial records.
export const personReferenceSchema = z.union([
  identitySchema,
  z.string().transform((_id) => identitySchema.parse({ _id })),
]);
export const clientSchema = entitySchema.extend({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  phoneNumber: z.string().default(""),
  contactName: z.string().optional(),
  contactPhoneNumber: z.string().optional(),
  contactEmail: z.string().optional(),
  accountManager: z.string().optional(),
  notes: z.string().optional(),
  clientStatus: accountStatusSchema.optional(),
  tenantId: z.string().optional(),
});
export const clientReferenceSchema = z.union([
  clientSchema,
  z.string().transform((_id) => clientSchema.parse({ _id })),
  z.null().transform(() => clientSchema.parse({ _id: "" })),
]);
export const userSchema = entitySchema.merge(identitySchema).extend({
  userName: z.string(),
  email: z.string(),
  role: z.string(),
  roleId: z.string(),
  roleName: z.string(),
  scope: roleScopeSchema,
  isPlatformAdmin: z.boolean(),
  status: accountStatusSchema,
  permissions: z.array(z.string()).default([]),
  tenantId: z.string().nullable().optional(),
  supervisorName: z.string().optional(),
  address: z.string().optional(),
  dateOfBirth: z.string().nullable().optional(),
  dateOfHire: z.string().nullable().optional(),
  position: z.string().optional(),
  empContactName: z.string().optional(),
  empPhoneNumber: z.string().optional(),
  bankAcNo: z.string().optional(),
  bankName: z.string().optional(),
  bankAcBranch: z.string().optional(),
  payFrequency: payFrequencySchema.optional(),
  notes: z.string().optional(),
  isDeleted: z.boolean().optional(),
  mustChangePassword: z.boolean().default(false),
});
export const sessionUserSchema = userSchema.extend({
  id: z.string(),
  supervisor: z
    .object({ id: z.string(), name: z.string() })
    .nullable()
    .optional(),
});
export const permissionSchema = entitySchema.extend({
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  group: z.string().default("Other"),
  platformOnly: z.boolean().optional(),
});
export const roleSchema = entitySchema.extend({
  key: z.string(),
  name: z.string(),
  description: z.string().default(""),
  scope: roleScopeSchema,
  isActive: z.boolean(),
  isSystem: z.boolean(),
  permissions: z.array(permissionSchema).default([]),
});
export const receiptSchema = z.object({
  _id: z.string().optional(),
  amount: z.number(),
  paymentDate: z.string(),
  method: paymentMethodSchema,
  referenceNumber: z.string().default(""),
  jobName: z.string().optional(),
  jobDate: z.string().optional(),
  clientName: z.string().optional(),
  clientEmail: z.string().optional(),
  clientAddress: z.string().optional(),
  clientPhoneNumber: z.string().optional(),
  payeeName: z.string().optional(),
  payeeEmail: z.string().optional(),
  payeePhoneNumber: z.string().optional(),
  hours: z.number().optional(),
  hourRate: z.number().optional(),
});
export const timeEntrySchema = z.object({
  signInTime: z.string().nullable().optional(),
  signOffTime: z.string().nullable().optional(),
  description: z.string().default(""),
  hours: z.number().default(0),
  hourRate: z.number().optional(),
  payoutAmount: z.number().optional(),
  payoutBatchId: z.string().nullable().optional(),
});
export const assignmentSchema = z.object({
  staff: personReferenceSchema,
  isAssigned: z.boolean().optional(),
  estimatedHours: z.number().optional(),
  estimatedPayment: z.number().optional(),
  hours: z.number().default(0),
  hourRate: z.number().default(0),
  payment: z.number().default(0),
  paymentStatus: paymentStatusSchema.default("Pending"),
  payoutReceipts: z.array(receiptSchema).default([]),
  timeEntries: z.array(timeEntrySchema).default([]),
  payoutBatchTotal: z.number().default(0),
  isSignIn: z.boolean().default(false),
  isSignOff: z.boolean().default(false),
  signInTime: z.string().nullable().optional(),
  signOffTime: z.string().nullable().optional(),
});
export const jobSchema = entitySchema.extend({
  jobName: z.string(),
  description: z.string(),
  client: clientReferenceSchema,
  assignedStaff: z.array(personReferenceSchema).default([]),
  staffAssignments: z.array(assignmentSchema).default([]),
  currentStaffAssignment: assignmentSchema.nullable().optional(),
  staffAssignment: assignmentSchema.nullable().optional(),
  jobStatus: jobStatusSchema,
  notes: z.string().optional(),
  jobDate: z.string().optional(),
  orgNoOfhours: z.number().optional(),
  orgHourRate: z.number().optional(),
  orgTotal: z.number().optional(),
  estNoOfhours: z.number().optional(),
  staffPayTotal: z.number().optional(),
  staffHoursTotal: z.number().optional(),
  staffPaymentTotal: z.number().optional(),
  noOfhours: z.number().optional(),
  hourRate: z.number().optional(),
  payment: z.number().optional(),
  paymentStatus: paymentStatusSchema.optional(),
  receivedPayments: z.array(receiptSchema).default([]),
  signInTime: z.string().nullable().optional(),
  signOffTime: z.string().nullable().optional(),
  isSignIn: z.boolean().optional(),
  isSignOff: z.boolean().optional(),
});
export const invoiceSchema = entitySchema.extend({
  invoiceTitle: z.string(),
  invoiceDescription: z.string(),
  client: clientReferenceSchema,
  sendDate: z.string().optional(),
  amount: z.number().optional(),
  notes: z.string().optional(),
  invoiceStatus: paymentStatusSchema,
});
export const payrollEntrySchema = z.object({
  jobName: z.string(),
  jobDate: z.string().optional(),
  signInTime: z.string().nullable().optional(),
  signOffTime: z.string().nullable().optional(),
  description: z.string().default(""),
  hours: z.number(),
  hourRate: z.number(),
  amount: z.number(),
});
export const payrollReceiptSchema = receiptSchema.extend({
  _id: z.string(),
  receiptNumber: z.string(),
  payFrequency: payFrequencySchema,
  periodStart: z.string(),
  periodEnd: z.string(),
  entries: z.array(payrollEntrySchema),
});
export const payrollStaffSchema = z.object({
  _id: z.string().optional(),
  name: z.string(),
  email: z.string().optional(),
  phoneNumber: z.string().optional(),
  payFrequency: payFrequencySchema,
});
export type User = z.infer<typeof userSchema>;
export type SessionUser = z.infer<typeof sessionUserSchema>;
export type Client = z.infer<typeof clientSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Permission = z.infer<typeof permissionSchema>;
export type Job = z.infer<typeof jobSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type TimeEntry = z.infer<typeof timeEntrySchema>;
export type Invoice = z.infer<typeof invoiceSchema>;
export type Receipt = z.infer<typeof receiptSchema>;
export type PayrollReceipt = z.infer<typeof payrollReceiptSchema>;
export type PayrollEntry = z.infer<typeof payrollEntrySchema>;
export type PayrollStaff = z.infer<typeof payrollStaffSchema>;
