import express from "express";
import {
  addJob, updatedJob, getTotalAndProfit, getAllJobsCount, paymentJob, getStaffJobsbyId,
  getFilteredJobs, getInvoice, getJobsByStaffId, signInJob, signOffJob,
  getAllCompletedJobs, deleteJobById, getJobById, getAllJobs, getAllJobPagination, updateStatus,
} from "../controllers/jobController.js";
import { authenticate, requireRoles } from "../middleware/authentication.js";
import { requireOwnedRecord } from "../middleware/authorization.js";
import Job from "../models/jobModel.js";
import Client from "../models/clientModel.js";
import Staff from "../models/staffModel.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();
router.use(authenticate);

router.post("/addJob", requireRoles("superAdmin", "admin"), asyncHandler(addJob));
router.put("/updatedJob/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Job), asyncHandler(updatedJob));
router.delete("/deleteJobById/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Job), asyncHandler(deleteJobById));
router.get("/getJobById/:id", requireRoles("superAdmin", "admin", "staff"), requireOwnedRecord(Job, { ownerType: "job" }), asyncHandler(getJobById));
router.get("/getAllJobPagination", requireRoles("superAdmin", "admin", "staff"), asyncHandler(getAllJobPagination));
router.get("/getAllJobs", requireRoles("superAdmin", "admin", "staff"), asyncHandler(getAllJobs));
router.get("/getCount", requireRoles("superAdmin", "admin"), asyncHandler(getAllJobsCount));
router.get("/getTotalAndProfit", requireRoles("superAdmin", "admin"), asyncHandler(getTotalAndProfit));
router.get("/getAllCompletedJobs", requireRoles("superAdmin", "admin"), asyncHandler(getAllCompletedJobs));
router.patch("/updateStatus/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Job), asyncHandler(updateStatus));
router.put("/signInJob/:jobId", requireRoles("superAdmin", "admin", "staff"), requireOwnedRecord(Job, { param: "jobId", ownerType: "job" }), asyncHandler(signInJob));
router.put("/signOffJob/:jobId", requireRoles("superAdmin", "admin", "staff"), requireOwnedRecord(Job, { param: "jobId", ownerType: "job" }), asyncHandler(signOffJob));
router.get("/getInvoice/:jobId", requireRoles("superAdmin", "admin"), requireOwnedRecord(Job, { param: "jobId" }), asyncHandler(getInvoice));
router.get("/getJobsbyStaff/:staffId", requireRoles("superAdmin", "admin", "staff"), asyncHandler(getJobsByStaffId));
router.get("/getFilteredJobs/:clientId", requireRoles("superAdmin", "admin"), requireOwnedRecord(Client, { param: "clientId" }), asyncHandler(getFilteredJobs));
router.get("/getStaffJobsbyId/:assignedStaff", requireRoles("superAdmin", "admin"), requireOwnedRecord(Staff, { param: "assignedStaff" }), asyncHandler(getStaffJobsbyId));
router.put("/paymentJob", requireRoles("superAdmin", "admin"), asyncHandler(paymentJob));

export default router;
