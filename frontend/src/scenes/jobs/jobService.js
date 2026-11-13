import { apiRequest } from "../../services/apiClient";

export const jobService = {
  getAll: (params) => apiRequest("job/getAllJobPagination", { params }),
  getAllJobs: (params) => apiRequest("job/getAllJobs", { params }),
  getAllCompleted: (params) => apiRequest("job/getAllCompletedJobs", { params }),
  getById: (id) => apiRequest(`job/getJobById/${encodeURIComponent(id)}`),
  getCount: () => apiRequest("job/getCount"),
  getTotalAndProfit: () => apiRequest("job/getTotalAndProfit"),
  create: (values) => apiRequest("job/addJob", { method: "POST", body: values }),
  update: (id, values) =>
    apiRequest(`job/updatedJob/${encodeURIComponent(id)}`, { method: "PUT", body: values }),
  updateStatus: (id, values) =>
    apiRequest(`job/updateStatus/${encodeURIComponent(id)}`, { method: "PATCH", body: values }),
  remove: (id) => apiRequest(`job/deleteJobById/${encodeURIComponent(id)}`, { method: "DELETE" }),
  updateAction: (action, id, body) =>
    apiRequest(`job/${action}/${encodeURIComponent(id)}`, { method: "PUT", body }),
  getByStaff: (staffId, params) =>
    apiRequest(`job/getJobsbyStaff/${encodeURIComponent(staffId)}`, { params }),
  getFilteredByClient: (clientId, filters = {}) =>
    apiRequest(`job/getFilteredJobs/${encodeURIComponent(clientId)}`, { params: filters }),
  getStaffJobs: (staffId, params) =>
    apiRequest(`job/getStaffJobsbyId/${encodeURIComponent(staffId)}`, { params }),
  getTimesheets: (params) => apiRequest("job/timesheets", { params }),
  getStaffPayroll: (staffId, params) =>
    apiRequest(`job/staffPayroll/${encodeURIComponent(staffId)}`, { params }),
  recordStaffPayroll: (staffId, values) =>
    apiRequest(`job/staffPayroll/${encodeURIComponent(staffId)}`, { method: "POST", body: values }),
  recordClientPayment: (jobId, values) =>
    apiRequest(`job/${encodeURIComponent(jobId)}/receivedPayments`, { method: "POST", body: values }),
  recordStaffPayout: (jobId, staffId, values) =>
    apiRequest(
      `job/${encodeURIComponent(jobId)}/staff/${encodeURIComponent(staffId)}/payoutReceipts`,
      { method: "POST", body: values }
    ),
};
