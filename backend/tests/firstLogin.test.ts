import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test, type TestContext } from "node:test";
import { type FilterQuery, Types } from "mongoose";
import User from "../models/userModel.js";
import Role from "../models/roleModel.js";
import RolePermission from "../models/rolePermissionModel.js";
import RefreshSession from "../models/refreshSessionModel.js";
import RefreshToken from "../models/refreshTokenModel.js";
import { authService } from "../services/authService.js";
import {
  createFirstLoginInvitation,
  firstLoginService,
} from "../services/firstLoginService.js";
import { userService } from "../services/userService.js";
import {
  hashPassword,
  verifyPasswordAndUpgrade,
} from "../services/credentialService.js";
import { completeFirstLoginSchema } from "../validation/auth.js";
import { createUserBodySchema } from "../validation/user.js";
import type { UserRecord } from "../types/models.js";
import { account, actorId, staffId, roleId, userPayload } from "./fixtures.js";

const temporaryPassword = "temporary-Password-123";
const newPassword = "employee-chosen-password-987";
const temporaryHash = await hashPassword(temporaryPassword);
function pendingAccount(context: TestContext) {
  const issued = createFirstLoginInvitation();
  const token = new URLSearchParams(
    new URL(issued.invitation.url).hash.slice(1),
  ).get("token");
  assert.ok(token);
  const user = new User({
    _id: staffId,
    userName: "New employee",
    email: "staff@example.com",
    password: temporaryHash,
    role: roleId,
    tenantId: actorId,
    mustChangePassword: true,
    firstLoginTokenHash: issued.tokenHash,
    firstLoginExpiresAt: issued.invitation.expiresAt,
  });
  context.mock.method(User, "findOne", (filter: FilterQuery<UserRecord>) => ({
    select: async () =>
      user.mustChangePassword &&
      user.firstLoginTokenHash === filter.firstLoginTokenHash &&
      user.firstLoginExpiresAt &&
      user.firstLoginExpiresAt > new Date() &&
      user.status === "active" &&
      !user.isDeleted
        ? user
        : null,
  }));
  context.mock.method(Role, "exists", async () => ({
    _id: new Types.ObjectId(roleId),
  }));
  context.mock.method(RefreshSession, "find", () => ({
    select: async () => [],
  }));
  context.mock.method(RefreshSession, "updateMany", async () => ({
    modifiedCount: 0,
  }));
  context.mock.method(
    User,
    "findOneAndUpdate",
    (
      filter: FilterQuery<UserRecord>,
      update: {
        $set: { password: string; mustChangePassword: boolean };
        $unset: { firstLoginTokenHash: string; firstLoginExpiresAt: string };
      },
    ) => ({
      select: async () => {
        if (
          !user.mustChangePassword ||
          user.firstLoginTokenHash !== filter.firstLoginTokenHash ||
          user.password !== filter.password
        )
          return null;
        assert.deepEqual(update.$unset, {
          firstLoginTokenHash: "",
          firstLoginExpiresAt: "",
        });
        user.password = update.$set.password;
        user.mustChangePassword = false;
        user.firstLoginTokenHash = undefined;
        user.firstLoginExpiresAt = undefined;
        return { _id: user._id };
      },
    }),
  );
  return { user, input: { token, temporaryPassword, newPassword }, issued };
}

test("invitations have a random token, a digest, a 24-hour expiry and no password in the URL", () => {
  const first = createFirstLoginInvitation();
  const second = createFirstLoginInvitation();
  const url = new URL(first.invitation.url);
  const token = new URLSearchParams(url.hash.slice(1)).get("token");
  assert.ok(token);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(url.pathname, "/first-login");
  assert.equal(url.search, "");
  assert.equal(
    first.tokenHash,
    createHash("sha256").update(token).digest("hex"),
  );
  assert.notEqual(first.tokenHash, token);
  assert.notEqual(first.invitation.url, second.invitation.url);
  assert.ok(
    Math.abs(first.invitation.expiresAt.getTime() - Date.now() - 86_400_000) <
      1000,
  );
});

test("production invitations use only a configured HTTPS frontend origin", () => {
  const savedNodeEnv = process.env.NODE_ENV;
  const savedFrontendUrl = process.env.FRONTEND_APP_URL;
  try {
    process.env.NODE_ENV = "production";
    process.env.FRONTEND_APP_URL = "http://app.example.com";
    assert.throws(createFirstLoginInvitation, /HTTPS in production/);
    process.env.FRONTEND_APP_URL = "https://app.example.com";
    assert.equal(
      new URL(createFirstLoginInvitation().invitation.url).origin,
      "https://app.example.com",
    );
    process.env.FRONTEND_APP_URL = "https://user:password@app.example.com";
    assert.throws(createFirstLoginInvitation, /application's origin/);
  } finally {
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
    if (savedFrontendUrl === undefined) delete process.env.FRONTEND_APP_URL;
    else process.env.FRONTEND_APP_URL = savedFrontendUrl;
  }
});

test("new accounts always require setup and user responses never expose password or invitation hashes", async (context) => {
  const role = new Role({
    _id: roleId,
    key: "staff",
    name: "Staff",
    scope: "staff",
    isActive: true,
  });
  context.mock.method(Role, "findOne", async () => role);
  context.mock.method(Role, "findById", () => ({
    select: () => ({ lean: async () => role.toObject() }),
  }));
  context.mock.method(RolePermission, "find", () => ({
    populate: () => ({ lean: async () => [] }),
  }));
  context.mock.method(User, "findOne", (filter: FilterQuery<UserRecord>) =>
    filter.email
      ? { select: () => ({ lean: async () => null }) }
      : {
          populate: async () => ({
            _id: new Types.ObjectId(actorId),
            role: { scope: "tenant" },
          }),
        },
  );
  context.mock.method(User, "findById", () => ({
    select: () => ({ lean: async () => ({ userName: "Supervisor" }) }),
  }));
  let created: Partial<UserRecord> = {};
  context.mock.method(User, "create", async (data: Partial<UserRecord>) => {
    created = data;
    return new User({ ...data, _id: staffId });
  });
  const result = await userService.create(
    createUserBodySchema.parse({
      ...userPayload,
      password: temporaryPassword,
      mustChangePassword: false,
    }),
    account({
      permissions: [
        "users.assignRole",
        "users.tenant.assign",
        "users.bank.update",
      ],
    }),
  );
  assert.equal(created.mustChangePassword, true);
  assert.ok(created.password?.startsWith("$argon2"));
  assert.notEqual(created.password, temporaryPassword);
  assert.equal(result.user?.mustChangePassword, true);
  for (const field of [
    "password",
    "firstLoginTokenHash",
    "firstLoginExpiresAt",
  ])
    assert.equal(field in (result.user || {}), false);
  assert.equal(result.invitation.url.includes(temporaryPassword), false);
});

test("first-login DTOs reject malformed links and reusing the temporary password", () => {
  assert.equal(
    completeFirstLoginSchema.safeParse({
      token: "short",
      temporaryPassword,
      newPassword,
    }).success,
    false,
  );
  assert.equal(
    completeFirstLoginSchema.safeParse({
      token: "A".repeat(43),
      temporaryPassword,
      newPassword: temporaryPassword,
    }).success,
    false,
  );
  assert.equal(
    completeFirstLoginSchema.safeParse({
      token: "A".repeat(43),
      temporaryPassword,
      newPassword: "short",
    }).success,
    false,
  );
});

test("successful first login consumes the invitation, hashes the new password and rejects replay", async (context) => {
  const { user, input } = pendingAccount(context);
  await firstLoginService.complete(input);
  assert.equal(user.mustChangePassword, false);
  assert.equal(user.firstLoginTokenHash, undefined);
  assert.equal(user.firstLoginExpiresAt, undefined);
  assert.ok(await verifyPasswordAndUpgrade(user, newPassword));
  assert.equal(await verifyPasswordAndUpgrade(user, temporaryPassword), false);
  await assert.rejects(firstLoginService.complete(input), /invalid or expired/);
});

test("wrong passwords, expired links, inactive accounts and inactive roles cannot complete setup", async (context) => {
  const { user, input } = pendingAccount(context);
  await assert.rejects(
    firstLoginService.complete({
      ...input,
      temporaryPassword: "wrong-password",
    }),
    /invalid or expired/,
  );
  user.firstLoginExpiresAt = new Date(Date.now() - 1);
  await assert.rejects(firstLoginService.complete(input), /invalid or expired/);
  user.firstLoginExpiresAt = new Date(Date.now() + 10000);
  user.status = "inactive";
  await assert.rejects(firstLoginService.complete(input), /invalid or expired/);
  user.status = "active";
  context.mock.method(Role, "exists", async () => null);
  await assert.rejects(firstLoginService.complete(input), /invalid or expired/);
  assert.equal(user.mustChangePassword, true);
});

test("a lost atomic claim cannot overwrite another password or consume a replacement invitation", async (context) => {
  const { user, input } = pendingAccount(context);
  context.mock.method(User, "findOneAndUpdate", () => ({
    select: async () => null,
  }));
  await assert.rejects(firstLoginService.complete(input), /invalid or expired/);
  assert.equal(user.password, temporaryHash);
  assert.equal(user.mustChangePassword, true);
});

test("session revocation failures leave the first-login invitation available for retry", async (context) => {
  const { user, input } = pendingAccount(context);
  context.mock.method(RefreshSession, "updateMany", async () => {
    throw new Error("Session storage unavailable");
  });
  await assert.rejects(
    firstLoginService.complete(input),
    /Session storage unavailable/,
  );
  assert.equal(user.mustChangePassword, true);
  assert.equal(user.password, temporaryHash);
  assert.ok(user.firstLoginTokenHash);
});

test("pending accounts cannot create sessions or access protected endpoints with an existing token", async (context) => {
  const { user } = pendingAccount(context);
  await assert.rejects(
    authService.createSession(user),
    /first-login invitation/,
  );
  let filter: FilterQuery<UserRecord> = {};
  context.mock.method(User, "findOne", (query: FilterQuery<UserRecord>) => {
    filter = query;
    return { select: async () => user };
  });
  context.mock.method(RefreshSession, "findOne", () => ({
    select: async () => ({ _id: actorId }),
  }));
  assert.equal(
    await authService.authenticateAccess({ sub: staffId, sid: actorId }),
    null,
  );
  assert.deepEqual(filter.mustChangePassword, { $ne: true });
});

test("pending accounts cannot use refresh tokens to bypass first-login setup", async (context) => {
  const { user } = pendingAccount(context);
  const future = new Date(Date.now() + 100000);
  const token = {
    _id: new Types.ObjectId(roleId),
    session: new Types.ObjectId(actorId),
    familyId: "family",
    expiresAt: future,
    consumedAt: null,
  };
  context.mock.method(RefreshToken, "findOne", () => ({
    select: async () => token,
  }));
  context.mock.method(RefreshToken, "findOneAndUpdate", async () => token);
  context.mock.method(RefreshSession, "findById", async () => ({
    _id: actorId,
    user: staffId,
    expiresAt: future,
    absoluteExpiresAt: future,
    revokedAt: null,
  }));
  context.mock.method(RefreshSession, "updateOne", async () => ({
    modifiedCount: 1,
  }));
  context.mock.method(User, "findOne", () => ({ select: async () => user }));
  await assert.rejects(
    authService.refresh("a-refresh-token"),
    /Session expired/,
  );
});

test("replacement credentials are scoped, replace both secrets and do not reopen completed accounts", async (context) => {
  const { user, issued } = pendingAccount(context);
  const role = new Role({
    _id: roleId,
    scope: "staff",
    isActive: true,
  }).toObject();
  const managed = { ...user.toObject(), role };
  let filter: FilterQuery<UserRecord> = {};
  let replacement: Partial<UserRecord> = {};
  context.mock.method(User, "findOne", (query: FilterQuery<UserRecord>) => {
    filter = query;
    return { populate: async () => managed };
  });
  context.mock.method(
    User,
    "findOneAndUpdate",
    (
      _query: FilterQuery<UserRecord>,
      update: { $set: Partial<UserRecord> },
    ) => ({
      select: async () => {
        replacement = update.$set;
        return { _id: user._id };
      },
    }),
  );
  const supervisor = account({
    scope: "tenant",
    permissions: ["users.password.reset"],
  });
  const result = await userService.replaceFirstLoginInvitation(
    staffId,
    newPassword,
    supervisor,
  );
  assert.equal(filter.tenantId, actorId);
  assert.notEqual(result.invitation.url, issued.invitation.url);
  assert.notEqual(replacement.firstLoginTokenHash, issued.tokenHash);
  assert.ok(replacement.password?.startsWith("$argon2"));
  managed.mustChangePassword = false;
  await assert.rejects(
    userService.replaceFirstLoginInvitation(staffId, newPassword, supervisor),
    /awaiting first login/,
  );
  await assert.rejects(
    userService.replaceFirstLoginInvitation(
      staffId,
      newPassword,
      account({ permissions: [] }),
    ),
    /Access denied/,
  );
});

test("administrative password resets explicitly invalidate unselected invitation fields", async (context) => {
  const { user } = pendingAccount(context);
  // Managed-user reads normally omit both private invitation fields.
  user.firstLoginTokenHash = undefined;
  user.firstLoginExpiresAt = undefined;
  user.unmarkModified("firstLoginTokenHash");
  user.unmarkModified("firstLoginExpiresAt");
  context.mock.method(User, "findOne", () => ({ populate: async () => user }));
  context.mock.method(user, "save", async () => {
    assert.equal(user.isModified("firstLoginTokenHash"), true);
    assert.equal(user.isModified("firstLoginExpiresAt"), true);
    return user;
  });
  await userService.resetPassword(staffId, newPassword, account());
  assert.equal(user.mustChangePassword, true);
  assert.ok(await verifyPasswordAndUpgrade(user, newPassword));
});
