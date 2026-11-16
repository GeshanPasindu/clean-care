import {
  useServiceMutation,
  useServiceQuery,
} from "../../queries/queryHelpers";
import { invoiceService } from "../../services/invoiceService";
import type { QueryParams } from "../../types/api";
import type { PaymentStatus } from "../../types/domain";
import type { InvoiceValues } from "../../validation/forms";

export const invoiceQueryKeys = {
  all: ["invoices"],
  list: (filters: QueryParams) => ["invoices", "list", filters],
  detail: (id: string | undefined) => ["invoices", "detail", id],
};

export function useInvoices(filters: QueryParams) {
  return useServiceQuery(invoiceQueryKeys.list(filters), () =>
    invoiceService.getAll(filters),
  );
}

export function useInvoice(id: string | undefined) {
  return useServiceQuery(
    invoiceQueryKeys.detail(id),
    () => invoiceService.getById(id),
    {
      enabled: Boolean(id),
    },
  );
}

export function useCreateInvoice() {
  return useServiceMutation(invoiceService.create, {
    invalidate: [invoiceQueryKeys.all],
  });
}

export function useUpdateInvoice() {
  return useServiceMutation(
    ({ id, values }: { id: string | undefined; values: InvoiceValues }) =>
      invoiceService.update(id, values),
    { invalidate: [invoiceQueryKeys.all] },
  );
}

export function useDeleteInvoice() {
  return useServiceMutation(invoiceService.remove, {
    invalidate: [invoiceQueryKeys.all],
  });
}

export function useUpdateInvoiceStatus() {
  return useServiceMutation(
    ({ id, status }: { id: string; status: PaymentStatus }) =>
      invoiceService.updateStatus(id, status),
    { invalidate: [invoiceQueryKeys.all] },
  );
}
