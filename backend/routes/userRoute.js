import express from "express";
import {
  changeOwnPassword,
  changeUserRole,
  createUser,
  deleteUser,
  getAllUsers,
  getDeletedUsers,
  getMe,
  getUser,
  getUserCount,
  resetUserPassword,
  restoreUser,
  updateMe,
  updateUser,
  updateUserStatus,
} from "../controllers/userController.js";
import { authenticate, requirePermissions } from "../middleware/authentication.js";
import { requireUserRecordAccess } from "../middleware/authorization.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireTrustedOrigin } from "../config/security.js";

const router = express.Router();
router.use(authenticate);

router.get("/me", asyncHandler(getMe));
router.put("/me", requirePermissions("profile.update"), requireTrustedOrigin, asyncHandler(updateMe));
router.put("/me/password", requirePermissions("auth.password.change"), requireTrustedOrigin, asyncHandler(changeOwnPassword));
router.get("/count", requirePermissions("users.read"), asyncHandler(getUserCount));
router.get("/deleted", requirePermissions("users.restore"), asyncHandler(getDeletedUsers));
router.get("/", requirePermissions("users.read"), asyncHandler(getAllUsers));
router.post("/", requirePermissions("users.create"), requireTrustedOrigin, asyncHandler(createUser));
router.get("/:id", requirePermissions("users.read"), requireUserRecordAccess("id"), asyncHandler(getUser));
router.put("/:id", requirePermissions("users.update"), requireUserRecordAccess("id"), requireTrustedOrigin, asyncHandler(updateUser));
router.patch("/:id/role", requirePermissions("users.assignRole"), requireUserRecordAccess("id"), requireTrustedOrigin, asyncHandler(changeUserRole));
router.patch("/:id/status", requirePermissions("users.status.update"), requireUserRecordAccess("id"), requireTrustedOrigin, asyncHandler(updateUserStatus));
router.put("/:id/password", requirePermissions("users.password.reset"), requireUserRecordAccess("id"), requireTrustedOrigin, asyncHandler(resetUserPassword));
router.post("/:id/restore", requirePermissions("users.restore"), requireTrustedOrigin, asyncHandler(restoreUser));
router.delete("/:id", requirePermissions("users.delete"), requireUserRecordAccess("id"), requireTrustedOrigin, asyncHandler(deleteUser));

export default router;
