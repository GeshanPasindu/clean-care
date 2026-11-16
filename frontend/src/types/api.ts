import { z } from "zod";
import {
  clientSchema,
  invoiceSchema,
  jobSchema,
  paymentStatusSchema,
  payrollEntrySchema,
  payrollReceiptSchema,
  payrollStaffSchema,
  permissionSchema,
  receiptSchema,
  roleSchema,
  sessionUserSchema,
  userSchema,
} from "./domain";
export const resultSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  response_code: z.number().optional(),
});
export const paginationSchema = z.object({
  totalResult: z.number().optional(),
  total: z.number().optional(),
  totalPages: z.number(),
  currentPage: z.number(),
  pageSize: z.number(),
});
export const sessionSchema = resultSchema.extend({
  accessToken: z.string(),
  user: sessionUserSchema,
});
export const usersSchema = resultSchema.extend({
  users: z.array(userSchema),
  paginationInfo: paginationSchema,
});
export const userResultSchema = resultSchema.extend({ user: userSchema });
export const firstLoginInvitationSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string(),
});
export const invitationResultSchema = resultSchema.extend({
  invitation: firstLoginInvitationSchema,
});
export const createdUserSchema = userResultSchema.extend({
  invitation: firstLoginInvitationSchema,
});
export const clientsSchema = resultSchema.extend({
  clients: z.array(clientSchema),
  paginationInfo: paginationSchema.optional(),
});
export const clientResultSchema = resultSchema.extend({
  client: clientSchema.optional(),
  newClient: clientSchema.optional(),
  updatedClient: clientSchema.optional(),
});
export const rolesSchema = resultSchema.extend({ roles: z.array(roleSchema) });
export const permissionsSchema = resultSchema.extend({
  permissions: z.array(permissionSchema),
});
export const roleResultSchema = resultSchema.extend({
  role: roleSchema.optional(),
});
export const financialsSchema = z.object({
  totalOrgTotal: z.number().default(0),
  totalStaffPayTotal: z.number().default(0),
  totalReceived: z.number().default(0),
  totalProfit: z.number().default(0),
});
export const jobsSchema = resultSchema.extend({
  jobs: z.array(jobSchema),
  paginationInfo: paginationSchema.optional(),
  totalPayment: z.number().optional(),
  summary: financialsSchema.optional(),
});
export const jobResultSchema = resultSchema.extend({
  job: jobSchema.optional(),
  updatedJob: jobSchema.optional(),
  data: jobSchema.optional(),
});
export const invoicesSchema = resultSchema.extend({
  invoices: z.array(invoiceSchema),
  paginationInfo: paginationSchema,
});
export const invoiceResultSchema = resultSchema.extend({
  invoice: invoiceSchema.optional(),
  newInvoice: invoiceSchema.optional(),
  updatedInvoice: invoiceSchema.optional(),
});
export const countSchema = resultSchema.extend({ count: z.number() });
export const totalsSchema = resultSchema.extend({ data: financialsSchema });
export const paymentResultSchema = resultSchema.extend({
  receipt: receiptSchema,
  receivedTotal: z.number().optional(),
  balance: z.number(),
  paidTotal: z.number().optional(),
  paymentStatus: paymentStatusSchema.optional(),
});
export const payrollSchema = resultSchema.extend({
  staff: payrollStaffSchema,
  period: z.object({ periodStart: z.string(), periodEnd: z.string() }),
  entries: z.array(payrollEntrySchema),
  totalHours: z.number(),
  totalAmount: z.number(),
  payouts: z.array(payrollReceiptSchema),
  payoutPaginationInfo: paginationSchema,
});
export const payrollResultSchema = resultSchema.extend({
  payout: payrollReceiptSchema,
  projectionSyncPending: z.boolean(),
});
export const timesheetsSchema = resultSchema.extend({
  timesheets: z.array(
    z.object({
      id: z.string(),
      jobId: z.string(),
      jobName: z.string(),
      jobDate: z.string().optional(),
      staffId: z.string(),
      staffName: z.string(),
      signInTime: z.string(),
      signOffTime: z.string().nullable(),
      hours: z.number(),
      description: z.string(),
    }),
  ),
  totalHours: z.number(),
  paginationInfo: paginationSchema,
});
export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;
export type Pagination = z.infer<typeof paginationSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Payroll = z.infer<typeof payrollSchema>;
export type Timesheet = z.infer<typeof timesheetsSchema>["timesheets"][number];
