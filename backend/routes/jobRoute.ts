import express from "express";
import {
  addJob, updatedJob, getTotalAndProfit, getAllJobsCount, recordClientPayment, getStaffJobsbyId,
  getTimesheets,
  recordStaffPayroll,
  getFilteredJobs, getInvoice, getJobsByStaffId, signInJob, signOffJob,
  getAllCompletedJobs, deleteJobById, getJobById, getAllJobs, getAllJobPagination, updateStatus,
} from "../controllers/jobController.js";
import { authenticate, requirePermissions } from "../middleware/authentication.js";
import { requireOwnedRecord, requireUserPermission, requireUserRecordAccess } from "../middleware/authorization.js";
import Job from "../models/jobModel.js";
import Client from "../models/clientModel.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();
router.use(authenticate);

router.post("/addJob", requirePermissions("jobs.create"), asyncHandler(addJob));
router.put("/updatedJob/:id", requirePermissions("jobs.update"), requireOwnedRecord(Job, { ownerType: "job" }), asyncHandler(updatedJob));
router.delete("/deleteJobById/:id", requirePermissions("jobs.delete"), requireOwnedRecord(Job), asyncHandler(deleteJobById));
router.get("/getJobById/:id", requirePermissions("jobs.read"), requireOwnedRecord(Job, { ownerType: "job" }), asyncHandler(getJobById));
router.get("/getAllJobPagination", requirePermissions("jobs.read"), asyncHandler(getAllJobPagination));
router.get("/getAllJobs", requirePermissions("jobs.read"), asyncHandler(getAllJobs));
router.get("/getCount", requirePermissions("jobs.count.read"), asyncHandler(getAllJobsCount));
router.get("/getTotalAndProfit", requirePermissions("jobs.financials.read"), asyncHandler(getTotalAndProfit));
router.get("/getAllCompletedJobs", requirePermissions("jobs.completed.read"), asyncHandler(getAllCompletedJobs));
router.patch("/updateStatus/:id", requirePermissions("jobs.status.update"), requireOwnedRecord(Job, { ownerType: "job" }), asyncHandler(updateStatus));
router.put("/signInJob/:jobId", requirePermissions("jobs.attendance.sign"), requireOwnedRecord(Job, { param: "jobId", ownerType: "job" }), asyncHandler(signInJob));
router.put("/signOffJob/:jobId", requirePermissions("jobs.attendance.sign"), requireOwnedRecord(Job, { param: "jobId", ownerType: "job" }), asyncHandler(signOffJob));
router.get("/timesheets", requirePermissions("timesheets.read"), asyncHandler(getTimesheets));
router.get("/getInvoice/:jobId", requirePermissions("jobs.invoice.read"), requireOwnedRecord(Job, { param: "jobId" }), asyncHandler(getInvoice));
router.get("/getJobsbyStaff/:staffId", requirePermissions("jobs.read"), asyncHandler(getJobsByStaffId));
router.get("/getFilteredJobs/:clientId", requirePermissions("jobs.read"), requireOwnedRecord(Client, { param: "clientId" }), asyncHandler(getFilteredJobs));
router.get("/getStaffJobsbyId/:assignedStaff", requireUserPermission("assignedStaff", "payroll.self.read", "jobs.assigned.read"), requireUserRecordAccess("assignedStaff"), asyncHandler(getStaffJobsbyId));
router.get("/staffPayroll/:staffId", (_req, res) => res.status(410).json({ message: "Use Employee Payments or your paid receipts" }));
router.post("/staffPayroll/:staffId", requirePermissions("payroll.record"), asyncHandler(recordStaffPayroll));
router.post("/:jobId/receivedPayments", requirePermissions("clients.payment.record"), requireOwnedRecord(Job, { param: "jobId" }), asyncHandler(recordClientPayment));

export default router;
