import express from "express"

const router = express.Router();
import {getAllStaffCount,updateStaffById ,deleteStaffById,getStaffById,getAllStaff,getAllActiveStaff,getAllStaffsPagination,updateStatus} from "../controllers/staffController.js"
import { authenticate, requireRoles } from "../middleware/authentication.js";
import { requireOwnedRecord } from "../middleware/authorization.js";
import Staff from "../models/staffModel.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

router.use(authenticate);

router.put("/updateStaffById/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Staff), asyncHandler(updateStaffById));
router.delete("/deleteStaffById/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Staff), asyncHandler(deleteStaffById));
router.get("/getStaffById/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Staff), asyncHandler(getStaffById));
router.get("/getAllStaffsPagination", requireRoles("superAdmin", "admin"), asyncHandler(getAllStaffsPagination));
router.get("/getAllActiveStaff", requireRoles("superAdmin", "admin"), asyncHandler(getAllActiveStaff));
router.get("/getAllStaff", requireRoles("superAdmin", "admin"), asyncHandler(getAllStaff));
router.patch("/updateStatus/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Staff), asyncHandler(updateStatus));
router.get("/getAllStaffCount", requireRoles("superAdmin", "admin"), asyncHandler(getAllStaffCount));

export default router;
