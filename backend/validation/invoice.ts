import { z } from "zod";
import {
  objectIdSchema,
  optionalDateSchema,
  optionalNumberSchema,
  paymentStatusSchema,
  paginationQuerySchema,
  dateRangeShape,
  validateDateRange,
} from "./common.js";

export const createInvoiceBodySchema = z.object({
  invoiceTitle: z.string().trim().min(1).max(200),
  invoiceDescription: z.string().trim().min(1).max(10000),
  client: objectIdSchema,
  sendDate: optionalDateSchema,
  amount: optionalNumberSchema,
  notes: z.string().trim().max(2000).optional(),
});
export const updateInvoiceBodySchema = createInvoiceBodySchema.partial();
export const invoiceStatusBodySchema = z.object({
  invoiceStatus: paymentStatusSchema,
});
export const invoiceListQuerySchema = paginationQuerySchema
  .extend(dateRangeShape)
  .superRefine(validateDateRange);
