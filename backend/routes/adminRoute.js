import express from "express"
import { authenticate, requireRoles } from "../middleware/authentication.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();
import {updateAdminPassword,getAllAdmins,updateStatus} from "../controllers/adminController.js"

router.use(authenticate);
router.put("/updateAdminPassword/:id", requireRoles("superAdmin"), asyncHandler(updateAdminPassword));
router.get("/getAllAdmins", requireRoles("superAdmin"), asyncHandler(getAllAdmins));
router.patch("/updateStatus/:id", requireRoles("superAdmin"), asyncHandler(updateStatus));

export default router;
