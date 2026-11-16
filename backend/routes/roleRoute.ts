import express from "express";
import { createRole, deleteRole, getAssignableRoles, getPermissions, getRoles, updateRole } from "../controllers/roleController.js";
import { authenticate, requirePermissions } from "../middleware/authentication.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();
router.use(authenticate);
router.get("/assignable", requirePermissions("users.assignRole"), asyncHandler(getAssignableRoles));
router.get("/", requirePermissions("roles.read"), asyncHandler(getRoles));
router.get("/permissions", requirePermissions("roles.read"), asyncHandler(getPermissions));
router.post("/", requirePermissions("roles.manage"), asyncHandler(createRole));
router.put("/:id", requirePermissions("roles.manage"), asyncHandler(updateRole));
router.delete("/:id", requirePermissions("roles.manage"), asyncHandler(deleteRole));

export default router;
