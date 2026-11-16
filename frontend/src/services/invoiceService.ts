import type { QueryParams } from "../types/api";
import {
  invoiceResultSchema,
  invoicesSchema,
  resultSchema,
} from "../types/api";
import type { PaymentStatus } from "../types/domain";
import type { InvoiceValues } from "../validation/forms";
import { apiRequest } from "./apiClient";

export const invoiceService = {
  getAll: (params: QueryParams = {}) =>
    apiRequest("invoice/getAllInvoices", { params }, invoicesSchema),
  getById: (id: string | undefined) =>
    apiRequest(
      `invoice/getInvoiceById/${encodeURIComponent(id || "")}`,
      {},
      invoiceResultSchema,
    ),
  create: (values: InvoiceValues) =>
    apiRequest(
      "invoice/addInvoice",
      { method: "POST", body: values },
      invoiceResultSchema,
    ),
  remove: (id: string) =>
    apiRequest(
      `invoice/deleteInvoiceById/${encodeURIComponent(id || "")}`,
      { method: "DELETE" },
      resultSchema,
    ),
  update: (id: string | undefined, values: InvoiceValues) =>
    apiRequest(
      `invoice/updatedInvoice/${encodeURIComponent(id || "")}`,
      { method: "PUT", body: values },
      invoiceResultSchema,
    ),
  updateStatus: (id: string, status: PaymentStatus) =>
    apiRequest(
      `invoice/updateStatus/${encodeURIComponent(id || "")}`,
      { method: "PATCH", body: { invoiceStatus: status } },
      invoiceResultSchema,
    ),
};
