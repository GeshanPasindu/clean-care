import { apiRequest } from "./apiClient";

export const invoiceService = {
  getAll: (params) => apiRequest("invoice/getAllInvoices", { params }),
  getById: (id) => apiRequest(`invoice/getInvoiceById/${encodeURIComponent(id)}`),
  create: (values) => apiRequest("invoice/addInvoice", { method: "POST", body: values }),
  remove: (id) => apiRequest(`invoice/deleteInvoiceById/${encodeURIComponent(id)}`, { method: "DELETE" }),
  update: (id, values) =>
    apiRequest(`invoice/updatedInvoice/${encodeURIComponent(id)}`, { method: "PUT", body: values }),
  updateStatus: (id, status) =>
    apiRequest(`invoice/updateStatus/${encodeURIComponent(id)}`, { method: "PATCH", body: { invoiceStatus: status } }),
};
