import { z } from "zod";
import { jobStatuses } from "../types/domain.js";
import {
  objectIdSchema,
  optionalIdSchema,
  nonNegativeNumberSchema,
  optionalDateSchema,
  paginationQuerySchema,
  dateRangeShape,
  paymentBodySchema,
  calendarDateSchema,
  validateDateRange,
  queryIntegerSchema,
} from "./common.js";

const assignedStaffSchema = z
  .array(objectIdSchema)
  .min(1)
  .max(50)
  .refine(
    (ids) => new Set(ids).size === ids.length,
    "Duplicate staff assignments are not allowed",
  );
const jobBodySchema = z.object({
  jobName: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(10000),
  client: objectIdSchema,
  assignedStaff: assignedStaffSchema,
  staffRates: z.record(objectIdSchema, nonNegativeNumberSchema).optional(),
  orgNoOfhours: nonNegativeNumberSchema,
  orgHourRate: nonNegativeNumberSchema,
  estNoOfhours: nonNegativeNumberSchema,
  staffHourRate: nonNegativeNumberSchema,
  notes: z.string().trim().max(2000).optional(),
  jobDate: optionalDateSchema,
});
function validateStaffRates(
  value: { assignedStaff?: string[]; staffRates?: Record<string, number> },
  context: z.RefinementCtx,
): void {
  if (!value.assignedStaff || !value.staffRates) return;
  const selected = new Set(value.assignedStaff);
  for (const id of Object.keys(value.staffRates)) {
    if (!selected.has(id))
      context.addIssue({
        code: "custom",
        path: ["staffRates", id],
        message: "Hourly rates must belong to assigned staff",
      });
  }
}
export const createJobBodySchema =
  jobBodySchema.superRefine(validateStaffRates);
export const updateJobBodySchema = jobBodySchema
  .omit({ jobDate: true })
  .partial()
  .superRefine(validateStaffRates);
export const jobStatusBodySchema = z.object({ jobStatus: z.enum(jobStatuses) });
export const signInBodySchema = z.object({ staffId: optionalIdSchema });
export const signOffBodySchema = signInBodySchema.extend({
  description: z.string().trim().min(1).max(1000),
});
export const jobListQuerySchema = paginationQuerySchema
  .extend({
    ...dateRangeShape,
    staffId: optionalIdSchema,
    clientId: optionalIdSchema,
    jobStatus: z.enum(jobStatuses).optional(),
  })
  .superRefine(validateDateRange);
export const clientJobQuerySchema = jobListQuerySchema
  .safeExtend({
    minPayment: nonNegativeNumberSchema.optional(),
    maxPayment: nonNegativeNumberSchema.optional(),
    month: queryIntegerSchema(12).optional(),
    year: queryIntegerSchema(2200)
      .refine((value) => value >= 2000)
      .optional(),
  })
  .refine(
    (value) =>
      value.minPayment === undefined ||
      value.maxPayment === undefined ||
      value.minPayment <= value.maxPayment,
    {
      path: ["maxPayment"],
      message: "Maximum payment must be at least the minimum payment",
    },
  );
export const timesheetQuerySchema = paginationQuerySchema
  .extend({
    ...dateRangeShape,
    staffId: optionalIdSchema,
    limit: queryIntegerSchema(200).default(25),
    supervisorId: optionalIdSchema,
  })
  .refine(
    (value) =>
      !value.startDate || !value.endDate || value.startDate <= value.endDate,
    { path: ["endDate"], message: "End date must be on or after start date" },
  );
export const payrollQuerySchema = z
  .object({
    ...dateRangeShape,
    payoutPage: queryIntegerSchema().default(1),
    payoutLimit: queryIntegerSchema(100).default(25),
  })
  .superRefine(validateDateRange)
  .refine(
    (value) =>
      !value.startDate ||
      !value.endDate ||
      Date.parse(value.endDate) - Date.parse(value.startDate) < 366 * 86400000,
    { path: ["endDate"], message: "Payroll period must be within 12 months" },
  );
export const payrollBodySchema = paymentBodySchema
  .omit({ amount: true })
  .extend({ periodStart: calendarDateSchema, periodEnd: calendarDateSchema })
  .refine(
    (value) =>
      value.periodStart <= value.periodEnd &&
      Date.parse(value.periodEnd) - Date.parse(value.periodStart) <
        366 * 86400000,
    {
      path: ["periodEnd"],
      message: "Enter an ordered payroll period within 12 months",
    },
  );
export const staffPayoutBodySchema = paymentBodySchema.extend({
  legacyReceiptOnly: z.boolean().default(false),
});
export const jobIdParamsSchema = z.object({ jobId: objectIdSchema });
export const clientIdParamsSchema = z.object({ clientId: objectIdSchema });
export const staffIdParamsSchema = z.object({
  staffId: z.union([objectIdSchema, z.literal("self")]),
});
export const assignedStaffParamsSchema = z.object({
  assignedStaff: objectIdSchema,
});
export const payoutParamsSchema = jobIdParamsSchema.extend({
  staffId: objectIdSchema,
});
