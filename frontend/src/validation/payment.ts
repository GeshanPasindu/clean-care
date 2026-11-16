import { z } from "zod";
import { paymentMethodSchema } from "../types/domain";
import { numberInput, calendarDate } from "./common";

export const paymentFormSchema = z.object({
  amount: numberInput.pipe(
    z.number().positive("Enter an amount greater than zero"),
  ),
  paymentDate: calendarDate,
  method: paymentMethodSchema,
  referenceNumber: z.string().trim().max(120),
});

export const payrollFormSchema = paymentFormSchema
  .omit({ amount: true })
  .extend({ periodStart: calendarDate, periodEnd: calendarDate })
  .refine(
    (value) =>
      value.periodStart <= value.periodEnd &&
      Date.parse(value.periodEnd) - Date.parse(value.periodStart) <
        366 * 86400000,
    {
      path: ["periodEnd"],
      message: "Choose an ordered period within 12 months",
    },
  );

export type PaymentValues = z.output<typeof paymentFormSchema>;

export type PayrollValues = z.output<typeof payrollFormSchema>;
