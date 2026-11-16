import express from "express";
import {
  authenticate,
  requirePermissions,
} from "../middleware/authentication.js";
import { requireTrustedOrigin } from "../config/security.js";
import * as controller from "../controllers/employeePaymentController.js";
const router = express.Router();
router.use(authenticate);
router.get(
  "/me/receipts",
  requirePermissions("payroll.self.read"),
  controller.receipts,
);
router.get("/employees", controller.employees);
router.get("/employees/:employeeId/jobs", controller.jobs);
router.get("/", controller.list);
router.put(
  "/employees/:employeeId/salary",
  requirePermissions("salaries.manage"),
  requireTrustedOrigin,
  controller.salary,
);
router.post("/preview", requireTrustedOrigin, controller.preview);
router.post("/", requireTrustedOrigin, controller.prepare);
router.patch("/:id/paid", requireTrustedOrigin, controller.markPaid);
router.patch("/:id/synchronize", requireTrustedOrigin, controller.synchronize);
router.delete("/:id", requireTrustedOrigin, controller.cancel);
export default router;
