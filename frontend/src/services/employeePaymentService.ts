import { apiRequest } from "./apiClient";
import { resultSchema, type QueryParams } from "../types/api";
import {
  paymentEmployeesSchema,
  employeePaymentsSchema,
  paymentPreviewResultSchema,
  employeePaymentResultSchema,
  salaryResultSchema,
  payableJobsSchema,
} from "../types/payments";
import type {
  PrepareEmployeePayment,
  SalaryPlanValues,
  MarkPaidValues,
} from "../validation/employeePayments";

const prepareBody = ({ jobId, ...values }: PrepareEmployeePayment) => ({
  ...values,
  ...(values.frequency === "PerJob" ? { jobId } : {}),
});
export const employeePaymentService = {
  employees: (params: QueryParams) =>
    apiRequest("payments/employees", { params }, paymentEmployeesSchema),
  jobs: (id: string, params: QueryParams) =>
    apiRequest(
      `payments/employees/${encodeURIComponent(id)}/jobs`,
      { params },
      payableJobsSchema,
    ),
  list: (params: QueryParams) =>
    apiRequest("payments", { params }, employeePaymentsSchema),
  receipts: (params: QueryParams) =>
    apiRequest("payments/me/receipts", { params }, employeePaymentsSchema),
  preview: (values: PrepareEmployeePayment) =>
    apiRequest(
      "payments/preview",
      { method: "POST", body: prepareBody(values) },
      paymentPreviewResultSchema,
    ),
  prepare: (values: PrepareEmployeePayment) =>
    apiRequest(
      "payments",
      { method: "POST", body: prepareBody(values) },
      employeePaymentResultSchema,
    ),
  salary: (id: string, values: SalaryPlanValues) =>
    apiRequest(
      `payments/employees/${encodeURIComponent(id)}/salary`,
      { method: "PUT", body: values },
      salaryResultSchema,
    ),
  markPaid: (id: string, values: MarkPaidValues) =>
    apiRequest(
      `payments/${encodeURIComponent(id)}/paid`,
      { method: "PATCH", body: values },
      employeePaymentResultSchema,
    ),
  synchronize: (id: string) =>
    apiRequest(
      `payments/${encodeURIComponent(id)}/synchronize`,
      { method: "PATCH", body: {} },
      employeePaymentResultSchema,
    ),
  cancel: (id: string) =>
    apiRequest(
      `payments/${encodeURIComponent(id)}`,
      { method: "DELETE" },
      resultSchema,
    ),
};
