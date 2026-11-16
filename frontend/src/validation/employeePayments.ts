import { z } from "zod";
import { payoutFrequencySchema } from "../types/payments";
import { paymentMethodSchema } from "../types/domain";
import { calendarDate, numberInput, recordId } from "./common";

export const prepareEmployeePaymentSchema = z
  .object({
    employeeId: recordId,
    frequency: payoutFrequencySchema,
    date: calendarDate,
    jobId: z.string(),
  })
  .superRefine((value, ctx) => {
    if (
      value.frequency === "PerJob" &&
      !recordId.safeParse(value.jobId).success
    )
      ctx.addIssue({
        code: "custom",
        path: ["jobId"],
        message: "Choose a completed job",
      });
  });
export const salaryPlanFormSchema = z.object({
  amount: numberInput.refine(
    (amount) =>
      amount > 0 &&
      amount <= 1_000_000_000 &&
      Math.abs(amount * 100 - Math.round(amount * 100)) < 0.0001,
    "Use a positive salary with at most two decimal places (maximum 1,000,000,000)",
  ),
  frequency: z.enum(["Weekly", "Monthly"]),
  effectiveFrom: calendarDate,
});
export const markPaidFormSchema = z.object({
  paymentDate: calendarDate,
  method: paymentMethodSchema,
  referenceNumber: z.string().trim().max(120),
});
export type PrepareEmployeePayment = z.output<
  typeof prepareEmployeePaymentSchema
>;
export type SalaryPlanFields = z.input<typeof salaryPlanFormSchema>;
export type SalaryPlanValues = z.output<typeof salaryPlanFormSchema>;
export type MarkPaidValues = z.output<typeof markPaidFormSchema>;
