import express from "express";
import { changePassword, login, logout, logoutAll, me, refresh } from "../controllers/authController.js";
import { authenticate } from "../middleware/authentication.js";
import { authLimiter, loginLimiter } from "../middleware/rateLimiters.js";
import { requireTrustedOrigin } from "../config/security.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();
router.use(authLimiter);

router.post("/login", loginLimiter, requireTrustedOrigin, asyncHandler(login));
router.post("/refresh", requireTrustedOrigin, asyncHandler(refresh));
router.post("/logout", requireTrustedOrigin, asyncHandler(logout));
router.post("/logout-all", authenticate, requireTrustedOrigin, asyncHandler(logoutAll));
router.get("/me", authenticate, asyncHandler(me));
router.post("/change-password", authenticate, requireTrustedOrigin, asyncHandler(changePassword));

export default router;
