import { z } from "zod";
import { paginationSchema, resultSchema } from "./api";
import {
  paymentMethodSchema,
  payrollEntrySchema,
  payFrequencySchema,
} from "./domain";

export const payoutFrequencySchema = payFrequencySchema;
export const salarySchema = z.object({
  amount: z.number().positive(),
  frequency: z.enum(["Weekly", "Monthly"]),
  effectiveFrom: z.string(),
});
export const paymentEmployeeSchema = z.object({
  _id: z.string(),
  name: z.string(),
  email: z.string(),
  scope: z.enum(["staff", "tenant"]),
  status: z.string(),
  frequency: payoutFrequencySchema,
  salary: salarySchema.nullable(),
});
export const paymentPreviewSchema = z.object({
  payeeName: z.string(),
  kind: z.enum(["Work", "Salary"]),
  frequency: payoutFrequencySchema,
  periodStart: z.string(),
  periodEnd: z.string(),
  amount: z.number(),
  entries: z.array(payrollEntrySchema),
});
export const employeePaymentSchema = paymentPreviewSchema.extend({
  _id: z.string(),
  employeeId: z.string(),
  employeeScope: z.enum(["staff", "tenant"]),
  payeeEmail: z.string(),
  jobId: z.string().optional(),
  status: z.enum(["Pending", "Paid"]),
  receiptNumber: z.string().optional(),
  paymentDate: z.string().optional(),
  method: paymentMethodSchema.optional(),
  referenceNumber: z.string().default(""),
  paidAt: z.string().optional(),
  createdAt: z.string().optional(),
  jobTotalsPending: z.boolean().default(false),
});
export const paymentEmployeesSchema = resultSchema.extend({
  employees: z.array(paymentEmployeeSchema),
  paginationInfo: paginationSchema,
});
export const employeePaymentsSchema = resultSchema.extend({
  payments: z.array(employeePaymentSchema),
  paginationInfo: paginationSchema,
});
export const paymentPreviewResultSchema = resultSchema.extend({
  preview: paymentPreviewSchema,
});
export const employeePaymentResultSchema = resultSchema.extend({
  payment: employeePaymentSchema,
  syncPending: z.boolean().optional(),
});
export const salaryResultSchema = resultSchema.extend({ salary: salarySchema });
export const payableJobsSchema = resultSchema.extend({
  jobs: z.array(
    z.object({
      _id: z.string(),
      name: z.string(),
      date: z.string().optional(),
    }),
  ),
  paginationInfo: paginationSchema,
});
export type PaymentEmployee = z.infer<typeof paymentEmployeeSchema>;
export type EmployeePayment = z.infer<typeof employeePaymentSchema>;
export type PaymentPreview = z.infer<typeof paymentPreviewSchema>;
export type PayoutFrequency = z.infer<typeof payoutFrequencySchema>;
