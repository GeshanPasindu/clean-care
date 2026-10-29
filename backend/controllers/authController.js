import { createHash, randomBytes, randomUUID } from "node:crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import passport from "passport";
import Admin from "../models/adminModel.js";
import RefreshSession from "../models/refreshSessionModel.js";
import RefreshToken from "../models/refreshTokenModel.js";
import Staff from "../models/staffModel.js";
import User from "../models/userModel.js";
import { authCookieOptions } from "../config/security.js";
import { getAccessTokenSecret, verifyPasswordAndUpgrade } from "../middleware/passport.js";

const refreshCookieName = "cc_refresh";
const accessTokenLifetime = "10m";
const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const absoluteRefreshLifetimeMs = 90 * 24 * 60 * 60 * 1000;
const argonOptions = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 };

const tokenDigest = (token) => createHash("sha256").update(token).digest("hex");
const createRefreshToken = () => randomBytes(48).toString("base64url");
const revokeUserSessions = async (userId) => {
  const now = new Date();
  const sessions = await RefreshSession.find({ user: userId, revokedAt: null }).select("familyId");
  const familyIds = sessions.map((session) => session.familyId);
  await Promise.all([
    RefreshSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: now } }),
    familyIds.length
      ? RefreshToken.updateMany({ familyId: { $in: familyIds }, consumedAt: null }, { $set: { consumedAt: now } })
      : Promise.resolve(),
  ]);
};
const accessToken = (user, sessionId) =>
  jwt.sign(
    { sid: String(sessionId), jti: randomUUID() },
    getAccessTokenSecret(),
    {
      subject: String(user._id),
      expiresIn: accessTokenLifetime,
      issuer: "cleancare-api",
      audience: "cleancare-frontend",
      algorithm: "HS256",
    }
  );

const safeUser = async (user) => {
  const result = {
    id: String(user._id),
    _id: String(user._id),
    userName: user.userName,
    email: user.email,
    role: user.role,
    status: user.status,
    adminDetails: user.adminDetails || null,
    staffDetails: user.staffDetails || null,
    superAdminDetails: user.superAdminDetails || null,
  };

  if (user.role === "staff") {
    const staff = await Staff.findOne({ user: user._id }).select("adminId").populate({
      path: "adminId",
      select: "_id firstName lastName user",
      populate: { path: "user", select: "_id userName" },
    });
    if (staff?.adminId) {
      const supervisor = staff.adminId;
      result.supervisor = {
        id: String(supervisor._id),
        name: [supervisor.firstName, supervisor.lastName].filter(Boolean).join(" ") || supervisor.user?.userName || "",
      };
      result.supervisorName = result.supervisor.name;
    }
  }

  return result;
};

const setRefreshCookie = (res, token, expiresAt) => {
  res.cookie(refreshCookieName, token, {
    ...authCookieOptions(),
    expires: expiresAt,
    maxAge: Math.max(0, expiresAt.getTime() - Date.now()),
  });
};

export const clearRefreshCookie = (res) => {
  res.clearCookie(refreshCookieName, authCookieOptions());
};

const makeSession = async (user, req) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + refreshLifetimeMs);
  const absoluteExpiresAt = new Date(now.getTime() + absoluteRefreshLifetimeMs);
  const familyId = randomUUID();
  const session = await RefreshSession.create({
    user: user._id,
    familyId,
    expiresAt,
    absoluteExpiresAt,
    userAgent: String(req.get("user-agent") || "").slice(0, 512),
    ipAddress: String(req.ip || "").slice(0, 64),
  });
  const refreshToken = createRefreshToken();
  await RefreshToken.create({
    session: session._id,
    familyId,
    tokenHash: tokenDigest(refreshToken),
    expiresAt: absoluteExpiresAt,
  });
  return { session, refreshToken };
};

const sendSession = async (res, user, session, refreshToken) => {
  const publicUser = await safeUser(user);
  setRefreshCookie(res, refreshToken, session.expiresAt);
  return res.status(200).json({
    success: true,
    accessToken: accessToken(user, session._id),
    user: publicUser,
  });
};

export const login = (req, res, next) => {
  passport.authenticate("local", { session: false }, async (error, user) => {
    if (error) return next(error);
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    try {
      // A superAdmin can also own records created through the legacy single-tenant forms.
      if (user.role === "superAdmin" && !user.adminDetails) {
        const adminProfile = await Admin.findOne({ user: user._id }).select("_id") || await Admin.create({ user: user._id });
        user.adminDetails = adminProfile._id;
        await user.save();
      }

      const { session, refreshToken } = await makeSession(user, req);
      return await sendSession(res, user, session, refreshToken);
    } catch (sessionError) {
      return next(sessionError);
    }
  })(req, res, next);
};

export const refresh = async (req, res, next) => {
  const rawToken = req.cookies?.[refreshCookieName];
  if (!rawToken || typeof rawToken !== "string" || rawToken.length > 256) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: "Session expired" });
  }

  try {
    const digest = tokenDigest(rawToken);
    const tokenRecord = await RefreshToken.findOne({ tokenHash: digest }).select("+tokenHash");
    if (!tokenRecord) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Session expired" });
    }

    const session = await RefreshSession.findById(tokenRecord.session);
    if (!session) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Session expired" });
    }

    const now = new Date();
    if (tokenRecord.consumedAt) {
      await Promise.all([
        RefreshSession.updateMany({ familyId: tokenRecord.familyId, revokedAt: null }, { $set: { revokedAt: now } }),
        RefreshToken.updateMany({ familyId: tokenRecord.familyId, consumedAt: null }, { $set: { consumedAt: now } }),
      ]);
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Session reuse detected; sign in again" });
    }

    if (
      session.revokedAt ||
      session.expiresAt <= now ||
      session.absoluteExpiresAt <= now ||
      tokenRecord.expiresAt <= now
    ) {
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Session expired" });
    }

    const claimedToken = await RefreshToken.findOneAndUpdate(
      { _id: tokenRecord._id, consumedAt: null },
      { $set: { consumedAt: now } },
      { new: true }
    );
    if (!claimedToken) {
      await RefreshSession.updateMany({ familyId: tokenRecord.familyId, revokedAt: null }, { $set: { revokedAt: now } });
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Session reuse detected; sign in again" });
    }

    const user = await User.findById(session.user).select("_id userName email role status adminDetails staffDetails superAdminDetails");
    if (!user || user.status !== "active") {
      await RefreshSession.updateOne({ _id: session._id }, { $set: { revokedAt: now } });
      clearRefreshCookie(res);
      return res.status(401).json({ message: "Session expired" });
    }

    session.expiresAt = new Date(Math.min(now.getTime() + refreshLifetimeMs, session.absoluteExpiresAt.getTime()));
    session.lastUsedAt = now;
    await session.save();

    const nextRefreshToken = createRefreshToken();
    await RefreshToken.create({
      session: session._id,
      familyId: session.familyId,
      tokenHash: tokenDigest(nextRefreshToken),
      expiresAt: session.absoluteExpiresAt,
    });
    return await sendSession(res, user, session, nextRefreshToken);
  } catch (error) {
    return next(error);
  }
};

export const logout = async (req, res) => {
  const rawToken = req.cookies?.[refreshCookieName];
  if (rawToken && typeof rawToken === "string" && rawToken.length <= 256) {
    const tokenRecord = await RefreshToken.findOne({ tokenHash: tokenDigest(rawToken) }).select("familyId");
    if (tokenRecord) {
      const now = new Date();
      await Promise.all([
        RefreshSession.updateMany({ familyId: tokenRecord.familyId, revokedAt: null }, { $set: { revokedAt: now } }),
        RefreshToken.updateMany({ familyId: tokenRecord.familyId, consumedAt: null }, { $set: { consumedAt: now } }),
      ]);
    }
  }

  clearRefreshCookie(res);
  return res.status(200).json({ success: true });
};

export const logoutAll = async (req, res) => {
  await revokeUserSessions(req.user._id);
  clearRefreshCookie(res);
  return res.status(200).json({ success: true });
};

export const me = async (req, res) => res.status(200).json({ success: true, user: await safeUser(req.user) });

export const changePassword = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body || {};
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    newPassword.length < 10 ||
    newPassword.length > 128
  ) {
    return res.status(400).json({ message: "Use a new password between 10 and 128 characters" });
  }

  try {
    const user = await User.findById(req.user._id).select("+password");
    if (!user || !(await verifyPasswordAndUpgrade(user, currentPassword))) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await argon2.hash(newPassword, argonOptions);
    await user.save();
    await revokeUserSessions(user._id);
    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: "Password updated. Please sign in again." });
  } catch (error) {
    return next(error);
  }
};

export const authConfig = { refreshCookieName };
