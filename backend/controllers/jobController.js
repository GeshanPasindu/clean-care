import * as jobService from "../services/jobService.js";

const run = (serviceMethod) => async (req, res, next) => {
  try {
    const result = await serviceMethod({
      body: req.body,
      params: req.params,
      query: req.query,
      user: req.user,
    });
    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    return next(error);
  }
};

export const addJob = run(jobService.addJob);
export const updatedJob = run(jobService.updatedJob);
export const deleteJobById = run(jobService.deleteJobById);
export const getJobById = run(jobService.getJobById);
export const getAllJobs = run(jobService.getAllJobs);
export const getAllJobsCount = run(jobService.getAllJobsCount);
export const getTotalAndProfit = run(jobService.getTotalAndProfit);
export const getAllJobPagination = run(jobService.getAllJobPagination);
export const updateStatus = run(jobService.updateStatus);
export const getAllCompletedJobs = run(jobService.getAllCompletedJobs);
export const signInJob = run(jobService.signInJob);
export const signOffJob = run(jobService.signOffJob);
export const getTimesheets = run(jobService.getTimesheets);
export const getInvoice = run(jobService.getInvoice);
export const getJobsByStaffId = run(jobService.getJobsByStaffId);
export const getFilteredJobs = run(jobService.getFilteredJobs);
export const getStaffJobsbyId = run(jobService.getStaffJobsbyId);
export const recordClientPayment = run(jobService.recordClientPayment);
export const recordStaffPayout = run(jobService.recordStaffPayout);
export const getStaffPayroll = run(jobService.getStaffPayroll);
export const recordStaffPayroll = run(jobService.recordStaffPayroll);