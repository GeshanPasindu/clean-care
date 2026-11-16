import { z } from "zod";
import { recordId, requiredText, numberInput, calendarDate } from "./common";

export const invoiceFormSchema = z.object({
  invoiceTitle: requiredText("Invoice title"),
  invoiceDescription: requiredText("Description", 10000),
  client: recordId,
  amount: numberInput,
  sendDate: calendarDate,
  notes: z.string().trim().max(2000),
});

export const invoiceDefaults: z.input<typeof invoiceFormSchema> = {
  invoiceTitle: "",
  invoiceDescription: "",
  client: "",
  amount: "",
  sendDate: "",
  notes: "",
};

export type InvoiceValues = z.output<typeof invoiceFormSchema>;
