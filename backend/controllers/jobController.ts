import * as jobService from "../services/jobService.js";
import { validatedService as run } from "../middleware/validatedController.js";
import {
  requestSchema as request,
  emptySchema as empty,
  idParamsSchema as id,
  paginationQuerySchema,
  paymentBodySchema,
} from "../validation/common.js";
import {
  createJobBodySchema,
  updateJobBodySchema,
  jobListQuerySchema,
  clientJobQuerySchema,
  timesheetQuerySchema,
  payrollQuerySchema,
  payrollBodySchema,
  signInBodySchema,
  signOffBodySchema,
  jobStatusBodySchema,
  staffPayoutBodySchema,
  jobIdParamsSchema,
  clientIdParamsSchema,
  staffIdParamsSchema,
  assignedStaffParamsSchema,
  payoutParamsSchema,
} from "../validation/job.js";

export const addJob = run(
  request(createJobBodySchema, empty, empty),
  jobService.addJob,
);
export const updatedJob = run(
  request(updateJobBodySchema, id, empty),
  jobService.updatedJob,
);
export const deleteJobById = run(
  request(empty, id, empty),
  jobService.deleteJobById,
);
export const getJobById = run(request(empty, id, empty), jobService.getJobById);
export const getAllJobs = run(
  request(empty, empty, jobListQuerySchema),
  jobService.getAllJobs,
);
export const getAllJobsCount = run(
  request(empty, empty, empty),
  jobService.getAllJobsCount,
);
export const getTotalAndProfit = run(
  request(empty, empty, empty),
  jobService.getTotalAndProfit,
);
export const getAllJobPagination = run(
  request(empty, empty, jobListQuerySchema),
  jobService.getAllJobPagination,
);
export const updateStatus = run(
  request(jobStatusBodySchema, id, empty),
  jobService.updateStatus,
);
export const getAllCompletedJobs = run(
  request(empty, empty, paginationQuerySchema),
  jobService.getAllCompletedJobs,
);
export const signInJob = run(
  request(signInBodySchema, jobIdParamsSchema, empty),
  jobService.signInJob,
);
export const signOffJob = run(
  request(signOffBodySchema, jobIdParamsSchema, empty),
  jobService.signOffJob,
);
export const getTimesheets = run(
  request(empty, empty, timesheetQuerySchema),
  jobService.getTimesheets,
);
export const getInvoice = run(
  request(empty, jobIdParamsSchema, empty),
  jobService.getInvoice,
);
export const getJobsByStaffId = run(
  request(empty, staffIdParamsSchema, jobListQuerySchema),
  jobService.getJobsByStaffId,
);
export const getFilteredJobs = run(
  request(empty, clientIdParamsSchema, clientJobQuerySchema),
  jobService.getFilteredJobs,
);
export const getStaffJobsbyId = run(
  request(empty, assignedStaffParamsSchema, jobListQuerySchema),
  jobService.getStaffJobsbyId,
);
export const recordClientPayment = run(
  request(paymentBodySchema, jobIdParamsSchema, empty),
  jobService.recordClientPayment,
);
export const recordStaffPayout = run(
  request(staffPayoutBodySchema, payoutParamsSchema, empty),
  jobService.recordStaffPayout,
);
export const getStaffPayroll = run(
  request(empty, staffIdParamsSchema, payrollQuerySchema),
  jobService.getStaffPayroll,
);
export const recordStaffPayroll = run(
  request(payrollBodySchema, staffIdParamsSchema, empty),
  jobService.recordStaffPayroll,
);
