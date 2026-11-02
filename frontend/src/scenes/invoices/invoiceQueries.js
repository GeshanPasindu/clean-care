import { useServiceMutation, useServiceQuery } from "../../queries/queryHelpers";
import { invoiceService } from "../../services/invoiceService";

export const invoiceQueryKeys = {
  all: ["invoices"],
  list: (filters) => ["invoices", "list", filters],
  detail: (id) => ["invoices", "detail", id],
};

export function useInvoices(filters) {
  return useServiceQuery(invoiceQueryKeys.list(filters), () => invoiceService.getAll(filters));
}

export function useInvoice(id) {
  return useServiceQuery(invoiceQueryKeys.detail(id), () => invoiceService.getById(id), {
    enabled: Boolean(id),
  });
}

export function useCreateInvoice() {
  return useServiceMutation(invoiceService.create, { invalidate: [invoiceQueryKeys.all] });
}

export function useUpdateInvoice() {
  return useServiceMutation(
    ({ id, values }) => invoiceService.update(id, values),
    { invalidate: [invoiceQueryKeys.all] }
  );
}

export function useDeleteInvoice() {
  return useServiceMutation(invoiceService.remove, { invalidate: [invoiceQueryKeys.all] });
}

export function useUpdateInvoiceStatus() {
  return useServiceMutation(
    ({ id, status }) => invoiceService.updateStatus(id, status),
    { invalidate: [invoiceQueryKeys.all] }
  );
}
