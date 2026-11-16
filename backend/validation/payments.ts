import { z } from "zod";
import {
  calendarDateSchema,
  objectIdSchema,
  paginationQuerySchema,
  nonNegativeNumberSchema,
  paymentMethodSchema,
} from "./common.js";
import { payoutFrequencies } from "../types/payments.js";
export const employeeParamsSchema = z.object({ employeeId: objectIdSchema });
export const paymentParamsSchema = z.object({ id: objectIdSchema });
export const employeeListSchema = paginationQuerySchema.extend({
  scope: z.enum(["staff", "tenant"]).default("staff"),
});
export const paymentListSchema = paginationQuerySchema.extend({
  employeeId: objectIdSchema.optional(),
  status: z.enum(["Pending", "Paid"]).optional(),
  scope: z.enum(["staff", "tenant"]).default("staff"),
});
export const preparePaymentSchema = z
  .object({
    employeeId: objectIdSchema,
    frequency: z.enum(payoutFrequencies),
    date: calendarDateSchema,
    jobId: objectIdSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.frequency === "PerJob" && !value.jobId)
      context.addIssue({
        code: "custom",
        path: ["jobId"],
        message: "Choose a completed job",
      });
    if (value.frequency !== "PerJob" && value.jobId)
      context.addIssue({
        code: "custom",
        path: ["jobId"],
        message: "Job selection applies only to per-job payments",
      });
  });
export const salaryPlanSchema = z.object({
  amount: nonNegativeNumberSchema.refine(
    (value) =>
      value > 0 &&
      value <= 1_000_000_000 &&
      Math.abs(value * 100 - Math.round(value * 100)) < 0.0001,
    "Use a positive salary with at most two decimal places (maximum 1,000,000,000)",
  ),
  frequency: z.enum(["Weekly", "Monthly"]),
  effectiveFrom: calendarDateSchema,
});
export const markPaidSchema = z.object({
  paymentDate: calendarDateSchema,
  method: paymentMethodSchema,
  referenceNumber: z.string().trim().max(120).default(""),
});
