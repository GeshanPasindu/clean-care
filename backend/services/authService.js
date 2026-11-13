import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import RefreshSession from "../models/refreshSessionModel.js";
import RefreshToken from "../models/refreshTokenModel.js";
import Role from "../models/roleModel.js";
import User from "../models/userModel.js";
import { hashPassword, verifyPasswordAndUpgrade } from "./credentialService.js";
import { ServiceError } from "./serviceError.js";
import { revokeUserSessions } from "./sessionService.js";
import { getAccessTokenSecret } from "./tokenService.js";
import { getRolePermissionKeys } from "./authorizationService.js";

const accessTokenLifetime = "10m";
const refreshLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const absoluteRefreshLifetimeMs = 90 * 24 * 60 * 60 * 1000;
const tokenDigest = (token) => createHash("sha256").update(token).digest("hex");
const createRefreshToken = () => randomBytes(48).toString("base64url");
const userFields = "_id userName email role status firstName lastName address phoneNumber dateOfBirth position tenantId isDeleted deletedAt";

const createAccessToken = (user, sessionId) => jwt.sign(
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

async function getActiveRole(roleId) {
  if (!roleId) return null;
  const role = await Role.findOne({ _id: roleId, isActive: true }).lean();
  return role || null;
}

async function safeUser(user) {
  const role = await getActiveRole(user.roleId || user.role);
  if (!role) throw new ServiceError("This account's role is no longer active", 403);
  const [permissions, supervisor] = await Promise.all([
    getRolePermissionKeys(role._id),
    role.scope === "staff" && user.tenantId
      ? User.findById(user.tenantId).select("_id userName firstName lastName")
      : null,
  ]);
  const supervisorName = supervisor
    ? [supervisor.firstName, supervisor.lastName].filter(Boolean).join(" ") || supervisor.userName || ""
    : "";

  return {
    id: String(user._id),
    _id: String(user._id),
    userName: user.userName,
    email: user.email,
    role: role.key,
    roleId: String(role._id),
    roleName: role.name,
    scope: role.scope,
    isPlatformAdmin: role.scope === "platform",
    permissions,
    status: user.status,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    address: user.address || "",
    phoneNumber: user.phoneNumber || "",
    dateOfBirth: user.dateOfBirth || null,
    position: user.position || "",
    tenantId: user.tenantId ? String(user.tenantId) : null,
    supervisor: supervisor?._id ? { id: String(supervisor._id), name: supervisorName } : null,
    supervisorName,
    isDeleted: Boolean(user.isDeleted),
  };
}

async function createRefreshSession(user, requestMetadata) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + refreshLifetimeMs);
  const absoluteExpiresAt = new Date(now.getTime() + absoluteRefreshLifetimeMs);
  const familyId = randomUUID();
  const session = await RefreshSession.create({
    user: user._id,
    familyId,
    expiresAt,
    absoluteExpiresAt,
    userAgent: String(requestMetadata.userAgent || "").slice(0, 512),
    ipAddress: String(requestMetadata.ipAddress || "").slice(0, 64),
  });
  const refreshToken = createRefreshToken();
  await RefreshToken.create({
    session: session._id,
    familyId,
    tokenHash: tokenDigest(refreshToken),
    expiresAt: absoluteExpiresAt,
  });
  return { session, refreshToken };
}

async function buildSessionResult(user, session, refreshToken) {
  return {
    user: await safeUser(user),
    accessToken: createAccessToken(user, session._id),
    refreshToken,
    expiresAt: session.expiresAt,
  };
}

async function revokeRefreshFamily(familyId, now = new Date()) {
  await Promise.all([
    RefreshSession.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: now } }),
    RefreshToken.updateMany({ familyId, consumedAt: null }, { $set: { consumedAt: now } }),
  ]);
}

export const authService = {
  async authenticateLocal(email, password) {
    if (typeof email !== "string" || typeof password !== "string" || password.length > 256) return null;
    const user = await User.findOne({ email: email.trim().toLowerCase(), isDeleted: false }).select("+password");
    if (!user || user.status !== "active") {
      if (!user) await verifyPasswordAndUpgrade(null, password);
      return null;
    }
    if (!(await verifyPasswordAndUpgrade(user, password)) || !(await getActiveRole(user.role))) return null;
    return user;
  },

  async authenticateAccess(payload) {
    if (!payload.sub || !payload.sid) return null;
    const now = new Date();
    const [user, session] = await Promise.all([
      User.findOne({ _id: payload.sub, status: "active", isDeleted: false }).select(userFields),
      RefreshSession.findOne({
        _id: payload.sid,
        user: payload.sub,
        revokedAt: null,
        expiresAt: { $gt: now },
      }).select("_id user familyId"),
    ]);
    if (!user || !session || !(await getActiveRole(user.role))) return null;
    return safeUser(user);
  },

  async createSession(user, requestMetadata = {}) {
    if (user.isDeleted || user.status !== "active" || !(await getActiveRole(user.role))) {
      throw new ServiceError("This account is not active", 401);
    }
    const { session, refreshToken } = await createRefreshSession(user, requestMetadata);
    return buildSessionResult(user, session, refreshToken);
  },

  async refresh(rawToken) {
    if (!rawToken || typeof rawToken !== "string" || rawToken.length > 256) {
      throw new ServiceError("Session expired", 401);
    }
    const digest = tokenDigest(rawToken);
    const tokenRecord = await RefreshToken.findOne({ tokenHash: digest }).select("+tokenHash");
    if (!tokenRecord) throw new ServiceError("Session expired", 401);

    const session = await RefreshSession.findById(tokenRecord.session);
    if (!session) throw new ServiceError("Session expired", 401);

    const now = new Date();
    if (tokenRecord.consumedAt) {
      await revokeRefreshFamily(tokenRecord.familyId, now);
      throw new ServiceError("Session reuse detected; sign in again", 401);
    }
    if (session.revokedAt || session.expiresAt <= now || session.absoluteExpiresAt <= now || tokenRecord.expiresAt <= now) {
      throw new ServiceError("Session expired", 401);
    }

    const claimedToken = await RefreshToken.findOneAndUpdate(
      { _id: tokenRecord._id, consumedAt: null },
      { $set: { consumedAt: now } },
      { new: true }
    );
    if (!claimedToken) {
      await revokeRefreshFamily(tokenRecord.familyId, now);
      throw new ServiceError("Session reuse detected; sign in again", 401);
    }

    const user = await User.findOne({ _id: session.user, status: "active", isDeleted: false }).select(userFields);
    if (!user || !(await getActiveRole(user.role))) {
      await RefreshSession.updateOne({ _id: session._id }, { $set: { revokedAt: now } });
      throw new ServiceError("Session expired", 401);
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
    return buildSessionResult(user, session, nextRefreshToken);
  },

  async logout(rawToken) {
    if (!rawToken || typeof rawToken !== "string" || rawToken.length > 256) return;
    const tokenRecord = await RefreshToken.findOne({ tokenHash: tokenDigest(rawToken) }).select("familyId");
    if (tokenRecord) await revokeRefreshFamily(tokenRecord.familyId);
  },

  revokeAll(userId) {
    return revokeUserSessions(userId);
  },

  getSafeUser(user) {
    return safeUser(user);
  },

  async changePassword(userId, currentPassword, newPassword) {
    if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 10 || newPassword.length > 128) {
      throw new ServiceError("Use a new password between 10 and 128 characters", 400);
    }
    const user = await User.findOne({ _id: userId, status: "active", isDeleted: false }).select("+password");
    if (!user || !(await verifyPasswordAndUpgrade(user, currentPassword))) {
      throw new ServiceError("Current password is incorrect", 400);
    }
    user.password = await hashPassword(newPassword);
    await user.save();
    await revokeUserSessions(user._id);
  },
};
