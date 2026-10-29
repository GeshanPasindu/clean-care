import express from "express";
import {
  addUser,
  deleteUser,
  getAllUsers,
  getUser,
  updateAdmin,
  updateStaff,
  updateUser,
} from "../controllers/userController.js";
import { authenticate, requireRoles } from "../middleware/authentication.js";
import { requireOwnedRecord, requireSelf, requireUserRecordAccess } from "../middleware/authorization.js";
import Admin from "../models/adminModel.js";
import Staff from "../models/staffModel.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();
router.use(authenticate);

router.post("/addUser", requireRoles("superAdmin", "admin"), asyncHandler(addUser));
router.get("/getUser/:id", requireUserRecordAccess("id"), asyncHandler(getUser));
router.get("/getAllUsers", requireRoles("superAdmin"), asyncHandler(getAllUsers));
router.delete("/deleteUser/:id", requireRoles("superAdmin", "admin"), requireUserRecordAccess("id"), asyncHandler(deleteUser));
router.put("/updateStaff/:id", requireRoles("superAdmin", "admin"), requireOwnedRecord(Staff), asyncHandler(updateStaff));
router.put("/userUpdate/:id", requireSelf("id"), asyncHandler(updateUser));
router.put("/updateAdmin/:id", requireRoles("superAdmin"), requireOwnedRecord(Admin, { ownerField: "user" }), asyncHandler(updateAdmin));

export default router;
