import { z } from "zod";
import {
  accountStatuses,
  paymentMethods,
  paymentStatuses,
} from "../types/domain.js";

export const emptySchema = z.object({}).default({});
export const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "A valid record ID is required");
export const idParamsSchema = z.object({ id: objectIdSchema });
export const optionalIdSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  objectIdSchema.optional(),
);
export const accountStatusSchema = z.enum(accountStatuses);
export const paymentStatusSchema = z.enum(paymentStatuses);
export const paymentMethodSchema = z.enum(paymentMethods);
export const emailSchema = z.string().trim().toLowerCase().max(254).email();
export const passwordSchema = z.string().min(10).max(128);
export const textSchema = z.string().trim().max(2000);
export const nonNegativeNumberSchema = z
  .union([z.number(), z.string().trim().min(1)])
  .transform(Number)
  .pipe(z.number().finite().min(0));
export const optionalNumberSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  nonNegativeNumberSchema.optional(),
);
export const dateStringSchema = z.union([
  z.iso.date(),
  z.iso.datetime({ offset: true, local: true }),
]);
export const dateSchema = z
  .union([dateStringSchema, z.date()])
  .transform((value) => new Date(value));
export const optionalDateSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  dateSchema.optional(),
);
export const nullableDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  dateSchema.nullable().optional(),
);
export const calendarDateSchema = z.iso.date();
export const dateRangeShape = {
  startDate: calendarDateSchema.optional(),
  endDate: calendarDateSchema.optional(),
};
export function validateDateRange(
  value: { startDate?: string; endDate?: string },
  context: z.RefinementCtx,
): void {
  if ((value.startDate === undefined) !== (value.endDate === undefined)) {
    context.addIssue({
      code: "custom",
      path: [value.startDate === undefined ? "startDate" : "endDate"],
      message: "Provide both startDate and endDate",
    });
  } else if (
    value.startDate &&
    value.endDate &&
    value.startDate > value.endDate
  ) {
    context.addIssue({
      code: "custom",
      path: ["endDate"],
      message: "End date must be on or after start date",
    });
  }
}
export const queryIntegerSchema = (maximum = Number.MAX_SAFE_INTEGER) =>
  z
    .union([z.number(), z.string().regex(/^\d+$/)])
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximum));
export const paginationQuerySchema = z.object({
  page: queryIntegerSchema().default(1),
  limit: queryIntegerSchema(100).default(25),
  search: z.string().trim().max(100).default(""),
});
export const paymentBodySchema = z.object({
  amount: nonNegativeNumberSchema.refine(
    (value) => value > 0,
    "Amount must be greater than zero",
  ),
  paymentDate: dateStringSchema,
  method: paymentMethodSchema,
  referenceNumber: z.string().trim().max(120).default(""),
});
export const requestSchema = <
  B extends z.ZodType,
  P extends z.ZodType,
  Q extends z.ZodType,
>(
  body: B,
  params: P,
  query: Q,
) => z.object({ body, params, query });
