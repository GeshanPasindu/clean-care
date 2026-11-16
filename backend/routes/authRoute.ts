import express from "express";
import { login, logout, logoutAll, refresh, completeFirstLogin } from "../controllers/authController.js";
import { authenticate } from "../middleware/authentication.js";
import { authLimiter, loginLimiter, firstLoginLimiter } from "../middleware/rateLimiters.js";
import { requireTrustedOrigin } from "../config/security.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = express.Router();
router.use(authLimiter);
router.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

router.post("/login", loginLimiter, requireTrustedOrigin, asyncHandler(login));
router.post("/first-login", firstLoginLimiter, requireTrustedOrigin, asyncHandler(completeFirstLogin));
router.post("/refresh", requireTrustedOrigin, asyncHandler(refresh));
router.post("/logout", requireTrustedOrigin, asyncHandler(logout));
router.post("/logout-all", authenticate, requireTrustedOrigin, asyncHandler(logoutAll));

export default router;
