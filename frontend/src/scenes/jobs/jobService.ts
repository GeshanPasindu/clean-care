import { apiRequest } from "../../services/apiClient";
import type { QueryParams } from "../../types/api";
import {
  countSchema,
  jobResultSchema,
  jobsSchema,
  paymentResultSchema,
  resultSchema,
  timesheetsSchema,
  totalsSchema,
} from "../../types/api";
import type { JobStatus } from "../../types/domain";
import type { AttendanceAction, AttendanceInput } from "../../types/requests";
import type {
  JobValues,
  PaymentValues,
} from "../../validation/forms";

export const jobService = {
  getAll: (params: QueryParams = {}) =>
    apiRequest("job/getAllJobPagination", { params }, jobsSchema),
  getAllJobs: (params: QueryParams = {}) =>
    apiRequest("job/getAllJobs", { params }, jobsSchema),
  getAllCompleted: (params: QueryParams = {}) =>
    apiRequest("job/getAllCompletedJobs", { params }, jobsSchema),
  getById: (id: string | undefined) =>
    apiRequest(
      `job/getJobById/${encodeURIComponent(id || "")}`,
      {},
      jobResultSchema,
    ),
  getCount: () => apiRequest("job/getCount", {}, countSchema),
  getTotalAndProfit: () =>
    apiRequest("job/getTotalAndProfit", {}, totalsSchema),
  create: (values: JobValues) =>
    apiRequest("job/addJob", { method: "POST", body: values }, jobResultSchema),
  update: (id: string | undefined, values: Omit<JobValues, "jobDate">) =>
    apiRequest(
      `job/updatedJob/${encodeURIComponent(id || "")}`,
      { method: "PUT", body: values },
      jobResultSchema,
    ),
  updateStatus: (id: string, values: { jobStatus: JobStatus }) =>
    apiRequest(
      `job/updateStatus/${encodeURIComponent(id || "")}`,
      { method: "PATCH", body: values },
      jobResultSchema,
    ),
  remove: (id: string) =>
    apiRequest(
      `job/deleteJobById/${encodeURIComponent(id || "")}`,
      { method: "DELETE" },
      resultSchema,
    ),
  updateAction: (
    action: AttendanceAction,
    id: string | undefined,
    body: AttendanceInput,
  ) =>
    apiRequest(
      `job/${action}/${encodeURIComponent(id || "")}`,
      { method: "PUT", body },
      jobResultSchema,
    ),
  getByStaff: (staffId: string, params: QueryParams = {}) =>
    apiRequest(
      `job/getJobsbyStaff/${encodeURIComponent(staffId || "")}`,
      { params },
      jobsSchema,
    ),
  getFilteredByClient: (
    clientId: string | undefined,
    filters: QueryParams = {},
  ) =>
    apiRequest(
      `job/getFilteredJobs/${encodeURIComponent(clientId || "")}`,
      { params: filters },
      jobsSchema,
    ),
  getStaffJobs: (staffId: string | undefined, params: QueryParams = {}) =>
    apiRequest(
      `job/getStaffJobsbyId/${encodeURIComponent(staffId || "")}`,
      { params },
      jobsSchema,
    ),
  getTimesheets: (params: QueryParams = {}) =>
    apiRequest("job/timesheets", { params }, timesheetsSchema),
  recordClientPayment: (jobId: string, values: PaymentValues) =>
    apiRequest(
      `job/${encodeURIComponent(jobId)}/receivedPayments`,
      { method: "POST", body: values },
      paymentResultSchema,
    ),
  recordStaffPayout: (
    jobId: string,
    staffId: string,
    values: PaymentValues & { legacyReceiptOnly?: boolean },
  ) =>
    apiRequest(
      `job/${encodeURIComponent(jobId)}/staff/${encodeURIComponent(staffId || "")}/payoutReceipts`,
      { method: "POST", body: values },
      paymentResultSchema,
    ),
};
