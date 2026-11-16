import mongoose from "mongoose";
import type { FilterQuery } from "mongoose";
import type { AuthenticatedUser, EntityId, AccountStatus } from "../types/domain.js";
import type { UserRecord, UserDocument, UserView, RoleRecord } from "../types/models.js";
import type { CreateUserInput, UpdateUserInput, UpdateProfileInput, ChangeRoleInput, UserListQuery, PaginationQuery, UserScope } from "../types/requests.js";
import { pickDefined } from "../utils/objects.js";
import { errorCode } from "../utils/errors.js";
import validator from "validator";
import Client from "../models/clientModel.js";
import Job from "../models/jobModel.js";
import Role from "../models/roleModel.js";
import User from "../models/userModel.js";
import { hashPassword } from "./credentialService.js";
import { getRolePermissionKeys, roleScope } from "./authorizationService.js";
import { ServiceError } from "./serviceError.js";
import { revokeUserSessions } from "./sessionService.js";
import { createFirstLoginInvitation } from "./firstLoginService.js";

const profileFields = ["firstName", "lastName", "address", "phoneNumber", "dateOfBirth", "position"] as const;
const employeeFields = [
  "dateOfHire", "empContactName", "empPhoneNumber", "bankAcNo", "bankName", "bankAcBranch", "payFrequency", "notes",
] as const;
const bankFields = ["bankAcNo", "bankName", "bankAcBranch"] as const;
const selfEditableFields = [
  ...profileFields, "userName", "email", "empContactName", "empPhoneNumber", "bankAcNo", "bankName", "bankAcBranch",
] as const;
const readableFields = [
  "_id", "userName", "email", "role", "status", "firstName", "lastName", "address", "phoneNumber", "dateOfBirth",
  "position", "dateOfHire", "empContactName", "empPhoneNumber", "bankAcNo", "bankName", "bankAcBranch", "payFrequency",
  "notes", "activeJob", "tenantId", "isDeleted", "deletedAt", "deletedBy", "createdAt", "updatedAt", "mustChangePassword",
].join(" ");
const validId = (value: unknown) => validator.isMongoId(String(value || ""));
const parsePage = (value: number | undefined, fallback: number, max: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const fieldsFrom = pickDefined;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function findRole(roleId: string | undefined) {
  if (!validId(roleId)) throw new ServiceError("Select a valid role", 400);
  const role = await Role.findOne({ _id: roleId, isActive: true });
  if (!role) throw new ServiceError("Role not found or inactive", 404);
  return role;
}

async function assertRoleAssignable(role: RoleRecord, actor: AuthenticatedUser) {
  if (!actor?.permissions?.includes("users.assignRole")) {
    throw new ServiceError("You are not allowed to assign roles", 403);
  }
  if (role.scope === "platform") throw new ServiceError("Platform accounts are provisioned through the local bootstrap command", 403);
  if (role.scope === "staff" && roleScope(actor) === "platform" && !actor.permissions.includes("users.tenant.assign")) {
    throw new ServiceError("You are not allowed to assign a staff account to a tenant supervisor", 403);
  }
  if (roleScope(actor) !== "platform" && role.scope !== "staff") {
    throw new ServiceError("Only a platform administrator can assign tenant administrator roles", 403);
  }
  const rolePermissions = await getRolePermissionKeys(role._id);
  const actorPermissions = new Set(actor.permissions || []);
  if (roleScope(actor) !== "platform" && rolePermissions.some((key) => !actorPermissions.has(key))) {
    throw new ServiceError("You cannot assign a role with permissions you do not have", 403);
  }
}

async function populateRole(user: UserRecord) {
  if (user.role && typeof user.role === "object" && "key" in user.role) return user.role;
  return Role.findById(user.role?._id || user.role).select("key name scope isActive").lean();
}

async function presentUser(user: UserRecord | UserDocument, actor: AuthenticatedUser, { includePermissions = true }: { includePermissions?: boolean } = {}): Promise<UserView | null> {
  const role = await populateRole(user);
  if (!role) return null;
  const raw = user instanceof mongoose.Document ? user.toObject<UserRecord>() : user;
  const { password: _password, firstLoginTokenHash: _tokenHash, firstLoginExpiresAt: _expiresAt, ...fields } = raw;
  const result: UserView = {
    ...fields, roleId: String(role._id), role: role.key, roleName: role.name, scope: role.scope,
    isPlatformAdmin: role.scope === "platform", tenantId: raw.tenantId ? String(raw.tenantId) : null, mustChangePassword: Boolean(raw.mustChangePassword),
  };
  if (role.scope === "staff" && result.tenantId) {
    const supervisor = await User.findById(result.tenantId).select("_id userName firstName lastName").lean();
    result.supervisorName = supervisor
      ? [supervisor.firstName, supervisor.lastName].filter(Boolean).join(" ") || supervisor.userName || ""
      : "";
  }
  if (includePermissions) result.permissions = await getRolePermissionKeys(role._id);
  const isSelf = String(actor?._id || "") === String(result._id);
  if (!isSelf && !actor?.permissions?.includes("users.bank.read")) {
    delete result.bankAcNo;
    delete result.bankName;
    delete result.bankAcBranch;
  }
  return result;
}

function tenantFilter(actor: AuthenticatedUser): FilterQuery<UserRecord> {
  if (roleScope(actor) === "platform") return {};
  const tenantId = actor?.tenantId || (roleScope(actor) === "tenant" ? actor?._id : null);
  return tenantId ? { tenantId } : { _id: actor?._id };
}

async function findManagedUser(id: string, actor: AuthenticatedUser, { includeDeleted = false }: { includeDeleted?: boolean } = {}) {
  if (!validId(id)) throw new ServiceError("Invalid user id", 400);
  const user = await User.findOne({
    _id: id,
    ...tenantFilter(actor),
    ...(includeDeleted ? {} : { isDeleted: false }),
  }).populate<{ role: RoleRecord }>("role", "key name scope isActive");
  if (!user) throw new ServiceError("User not found", 404);
  if (user.role?.scope === "platform" && String(user._id) !== String(actor?._id)) {
    throw new ServiceError("Platform accounts cannot be managed through this endpoint", 403);
  }
  return user;
}

async function normalizeEmail(email: string, currentUserId: EntityId | null = null) {
  if (typeof email !== "string" || !validator.isEmail(email.trim())) throw new ServiceError("Enter a valid email address", 400);
  const normalized = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalized, ...(currentUserId ? { _id: { $ne: currentUserId } } : {}) }).select("_id").lean();
  if (existing) throw new ServiceError("An account with this email already exists", 409);
  return normalized;
}

async function validateTenantSupervisor(id: EntityId | null | undefined) {
  if (!validId(id)) throw new ServiceError("Select a valid supervisor account", 400);
  const user = await User.findOne({ _id: id, status: "active", isDeleted: false }).populate<{ role: RoleRecord }>("role", "scope");
  if (!user || user.role?.scope !== "tenant") throw new ServiceError("Select an active tenant administrator account", 400);
  return user;
}

async function assignedTenantForCreate(role: RoleRecord, body: Pick<CreateUserInput, "tenantId">, actor: AuthenticatedUser) {
  if (role.scope === "tenant") return null;
  if (roleScope(actor) === "platform") return (await validateTenantSupervisor(body.tenantId))?._id;
  if (roleScope(actor) === "tenant") return actor._id;
  throw new ServiceError("Only tenant administrators can create staff accounts", 403);
}

export const userService = {
  async create(body: CreateUserInput, actor: AuthenticatedUser) {
    if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 128) {
      throw new ServiceError("Passwords must be between 10 and 128 characters", 400);
    }
    const email = await normalizeEmail(body.email);
    let role: mongoose.HydratedDocument<RoleRecord> | null;
    if (roleScope(actor) === "platform") {
      role = await findRole(body.roleId);
      await assertRoleAssignable(role, actor);
    } else if (roleScope(actor) === "tenant") {
      role = await Role.findOne({ key: "staff", scope: "staff", isActive: true });
      if (!role) throw new ServiceError("The Staff role is not configured", 409);
    } else {
      throw new ServiceError("Only tenant administrators and superadmins can create user accounts", 403);
    }
    if (!actor.permissions?.includes("users.bank.update") && bankFields.some((field) => body[field])) {
      throw new ServiceError("You are not allowed to set user bank details", 403);
    }
    const tenantId = await assignedTenantForCreate(role, body, actor);
    const accountData = fieldsFrom(body, [...profileFields, ...employeeFields]);
    const { invitation, tokenHash } = createFirstLoginInvitation();

    try {
      const user = await User.create({
        ...accountData,
        userName: body.userName.trim(),
        email,
        password: await hashPassword(body.password),
        mustChangePassword: true,
        firstLoginTokenHash: tokenHash,
        firstLoginExpiresAt: invitation.expiresAt,
        role: role._id,
        status: "active",
        tenantId,
      });
      if (role.scope === "tenant") {
        user.tenantId = user._id;
        await user.save();
      }
      return { user: await presentUser(user, actor), invitation };
    } catch (error) {
      if (errorCode(error) === 11000) throw new ServiceError("An account with this email already exists", 409);
      throw error;
    }
  },

  async replaceFirstLoginInvitation(id: string, password: string, actor: AuthenticatedUser) {
    if (!actor.permissions.includes("users.password.reset")) {
      throw new ServiceError("Access denied", 403);
    }
    const user = await findManagedUser(id, actor);
    if (user._id.toString() === actor._id || !user.mustChangePassword || user.status !== "active" || !user.role.isActive) {
      throw new ServiceError("Only active accounts awaiting first login can receive replacement credentials", 409);
    }
    const { invitation, tokenHash } = createFirstLoginInvitation();
    const replaced = await User.findOneAndUpdate(
      { _id: user._id, role: user.role._id, tenantId: user.tenantId, mustChangePassword: true, status: "active", isDeleted: false },
      { $set: { password: await hashPassword(password), firstLoginTokenHash: tokenHash, firstLoginExpiresAt: invitation.expiresAt } },
      { new: true, runValidators: true },
    ).select("_id");
    if (!replaced) throw new ServiceError("Account changed. Refresh and try again.", 409);
    return { invitation };
  },

  async getById(id: string, actor: AuthenticatedUser) {
    const user = await findManagedUser(id, actor);
    return presentUser(user, actor);
  },

  async getMe(actor: AuthenticatedUser) {
    const user = await User.findOne({ _id: actor._id, isDeleted: false }).select(readableFields).populate<{ role: RoleRecord }>("role", "key name scope isActive");
    if (!user) throw new ServiceError("User not found", 404);
    return presentUser(user, actor);
  },

  async getAll(actor: AuthenticatedUser, { scope, roleId, status, search = "", page: rawPage, limit: rawLimit }: Partial<UserListQuery> = {}) {
    if (typeof search !== "string") throw new ServiceError("Invalid user search", 400);
    const filter: FilterQuery<UserRecord> = { ...tenantFilter(actor), isDeleted: false };
    if (roleId !== undefined) {
      if (!validId(roleId)) throw new ServiceError("Invalid role id", 400);
      filter.role = roleId;
    } else if (scope) {
      const allowedScopes = scope === "employees" ? ["tenant", "staff"] : [scope];
      if (allowedScopes.some((item) => !["platform", "tenant", "staff"].includes(item))) {
        throw new ServiceError("Invalid account scope", 400);
      }
      if (roleScope(actor) !== "platform" && allowedScopes.includes("platform")) {
        throw new ServiceError("Platform accounts cannot be listed here", 403);
      }
      const matchingRoles = await Role.find({ scope: { $in: allowedScopes } }).select("_id").lean();
      filter.role = { $in: matchingRoles.map((role) => role._id) };
    }
    if (status !== undefined) {
      if (!["active", "inactive"].includes(status)) throw new ServiceError("Invalid account status", 400);
      filter.status = status;
    }
    const normalizedSearch = search.trim().slice(0, 100);
    if (normalizedSearch) {
      const regex = { $regex: escapeRegex(normalizedSearch), $options: "i" };
      filter.$or = ["firstName", "lastName", "email", "userName", "phoneNumber", "position"].map((field) => ({ [field]: regex }));
    }
    const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePage(rawLimit, 25, 100);
    const [totalResult, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter).select(readableFields).populate<{ role: RoleRecord }>("role", "key name scope isActive")
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    return {
      users: await Promise.all(users.map((user) => presentUser(user, actor))),
      paginationInfo: { totalResult, totalPages: Math.ceil(totalResult / limit), currentPage: page, pageSize: limit },
    };
  },

  async count(actor: AuthenticatedUser, scope: UserScope = "employees") {
    const scopes = scope === "employees" ? ["tenant", "staff"] : [scope];
    if (scopes.some((item) => !["platform", "tenant", "staff"].includes(item))) {
      throw new ServiceError("Invalid account scope", 400);
    }
    if (roleScope(actor) !== "platform" && scopes.includes("platform")) {
      throw new ServiceError("Platform accounts cannot be counted here", 403);
    }
    const roleIds = await Role.find({ scope: { $in: scopes } }).select("_id").lean();
    return User.countDocuments({
      ...tenantFilter(actor),
      isDeleted: false,
      role: { $in: roleIds.map((role) => role._id) },
    });
  },

  async getDeleted(actor: AuthenticatedUser, { page: rawPage, limit: rawLimit }: Partial<PaginationQuery> = {}) {
    const filter = { ...tenantFilter(actor), isDeleted: true };
    const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePage(rawLimit, 25, 100);
    const [totalResult, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
      .select(readableFields)
      .populate<{ role: RoleRecord }>("role", "key name scope isActive")
      .sort({ deletedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ]);
    return {
      users: await Promise.all(users.map((user) => presentUser(user, actor))),
      paginationInfo: { totalResult, totalPages: Math.ceil(totalResult / limit), currentPage: page, pageSize: limit },
    };
  },

  async update(id: string, body: UpdateUserInput, actor: AuthenticatedUser) {
    const user = await findManagedUser(id, actor);
    if (body.roleId !== undefined || body.tenantId !== undefined) {
      throw new ServiceError("Use the role assignment action to change a user's role or supervisor", 400);
    }
    const isSelf = String(user._id) === String(actor?._id);
    if (!isSelf && !actor.permissions?.includes("users.bank.update") && bankFields.some((field) => body[field] !== undefined)) {
      throw new ServiceError("You are not allowed to update user bank details", 403);
    }
    const updates = fieldsFrom(body, [...profileFields, ...employeeFields, "userName", "email"]);
    if (body.userName !== undefined) updates.userName = body.userName.trim();
    if (body.email !== undefined) updates.email = await normalizeEmail(body.email, user._id);

    Object.assign(user, updates);
    try {
      await user.save();
    } catch (error) {
      if (errorCode(error) === 11000) throw new ServiceError("An account with this email already exists", 409);
      throw error;
    }
    return presentUser(user, actor);
  },

  async changeRole(id: string, { roleId, tenantId }: ChangeRoleInput, actor: AuthenticatedUser) {
    if (roleScope(actor) !== "platform" || !actor.permissions?.includes("users.assignRole")) {
      throw new ServiceError("Only a superadmin can change user roles", 403);
    }
    const user = await findManagedUser(id, actor);
    if (user.role?.scope === "platform") throw new ServiceError("The platform superadmin role is managed through the bootstrap process", 403);
    const nextRole = await findRole(roleId);
    await assertRoleAssignable(nextRole, actor);
    const roleIsChanging = String(nextRole._id) !== String(user.role?._id || user.role);
    const supervisorIsChanging = tenantId !== undefined && String(tenantId) !== String(user.tenantId || "");
    if (user.activeJob && (roleIsChanging || supervisorIsChanging)) {
      throw new ServiceError("Sign out of the active job before changing this user's role or supervisor", 409);
    }
    if (nextRole.scope === "staff" && tenantId && String(tenantId) === String(user._id)) {
      throw new ServiceError("A staff account must be assigned to another supervisor", 400);
    }

    if (nextRole.scope === "tenant" && user.role?.scope !== "tenant") {
      const [hasClients, hasJobs, hasChildUsers] = await Promise.all([
        Client.exists({ tenantId: user._id }),
        Job.exists({ tenantId: user._id }),
        User.exists({ _id: { $ne: user._id }, tenantId: user._id, isDeleted: false }),
      ]);
      if (hasClients || hasJobs || hasChildUsers) {
        throw new ServiceError("Transfer tenant records and accounts before changing this user's role", 409);
      }
      user.tenantId = user._id;
    } else if (nextRole.scope === "staff") {
      if (user.role?.scope === "tenant") {
        const [hasClients, hasJobs, hasChildUsers] = await Promise.all([
          Client.exists({ tenantId: user._id }),
          Job.exists({ tenantId: user._id }),
          User.exists({ _id: { $ne: user._id }, tenantId: user._id, isDeleted: false }),
        ]);
        if (hasClients || hasJobs || hasChildUsers) {
          throw new ServiceError("Transfer tenant records and accounts before changing this user's role", 409);
        }
      }
      const supervisorId = tenantId || (user.role?.scope === "staff" ? user.tenantId : null);
      const supervisor = await validateTenantSupervisor(supervisorId);
      user.tenantId = supervisor._id;
    }

    user.set("role", nextRole._id);
    await user.save();
    return presentUser(user, actor);
  },

  async updateSelf(actor: AuthenticatedUser, body: UpdateProfileInput = {}) {
    const updates = fieldsFrom(body, selfEditableFields);
    if (body.userName !== undefined) {
      if (typeof body.userName !== "string" || !body.userName.trim() || body.userName.trim().length > 120) {
        throw new ServiceError("Enter a valid user name", 400);
      }
      updates.userName = body.userName.trim();
    }
    if (body.email !== undefined) updates.email = await normalizeEmail(body.email, actor._id);
    const user = await User.findOneAndUpdate(
      { _id: actor._id, isDeleted: false },
      { $set: updates },
      { new: true, runValidators: true }
    ).select(readableFields).populate<{ role: RoleRecord }>("role", "key name scope isActive");
    if (!user) throw new ServiceError("User not found", 404);
    return presentUser(user, actor);
  },

  async updateStatus(id: string, status: AccountStatus, actor: AuthenticatedUser) {
    if (!["active", "inactive"].includes(status)) throw new ServiceError("Invalid account status", 400);
    const user = await findManagedUser(id, actor);
    if (status === "inactive" && user.activeJob) throw new ServiceError("Sign out of the active job before deactivating this account", 409);
    if (status === "inactive" && user.role?.scope === "tenant") {
      const [hasClients, hasJobs, hasStaffUsers] = await Promise.all([
        Client.exists({ tenantId: user._id }),
        Job.exists({ tenantId: user._id }),
        User.exists({ _id: { $ne: user._id }, tenantId: user._id, isDeleted: false }),
      ]);
      if (hasClients || hasJobs || hasStaffUsers) throw new ServiceError("Transfer this tenant's records and accounts before deactivating it", 409);
    }
    user.status = status;
    await user.save();
    if (status === "inactive") await revokeUserSessions(user._id);
    return presentUser(user, actor);
  },

  async resetPassword(id: string, password: string, actor: AuthenticatedUser) {
    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
      throw new ServiceError("Use a password between 10 and 128 characters", 400);
    }
    const user = await findManagedUser(id, actor);
    if (String(user._id) === String(actor?._id)) {
      throw new ServiceError("Use the current-password change endpoint for your own account", 403);
    }
    user.password = await hashPassword(password);
    user.firstLoginTokenHash = undefined;
    user.firstLoginExpiresAt = undefined;
    // These private paths are normally unselected; ensure their removal is saved.
    user.markModified("firstLoginTokenHash");
    user.markModified("firstLoginExpiresAt");
    await user.save();
    await revokeUserSessions(user._id);
  },

  async remove(id: string, actor: AuthenticatedUser) {
    const user = await findManagedUser(id, actor);
    if (String(user._id) === String(actor._id)) throw new ServiceError("You cannot delete your own account", 400);
    if (user.role?.scope === "tenant") {
      const [hasClients, hasJobs, hasChildUsers] = await Promise.all([
        Client.exists({ tenantId: user._id }),
        Job.exists({ tenantId: user._id }),
        User.exists({ _id: { $ne: user._id }, tenantId: user._id, isDeleted: false }),
      ]);
      if (hasClients || hasJobs || hasChildUsers) throw new ServiceError("Transfer this tenant's records and accounts before deleting it", 409);
    }
    user.status = "inactive";
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.deletedBy = new mongoose.Types.ObjectId(actor._id);
    user.activeJob = null;
    await user.save();
    await revokeUserSessions(user._id);
  },

  async restore(id: string, actor: AuthenticatedUser) {
    if (!validId(id)) throw new ServiceError("Invalid user id", 400);
    const user = await User.findOne({ _id: id, ...tenantFilter(actor), isDeleted: true }).populate<{ role: RoleRecord }>("role", "scope isActive");
    if (!user) throw new ServiceError("Deleted user not found", 404);
    if (user.role?.scope === "platform") throw new ServiceError("Platform accounts cannot be restored here", 403);
    if (!user.role?.isActive) throw new ServiceError("The user's role is inactive", 409);
    user.isDeleted = false;
    user.deletedAt = null;
    user.deletedBy = null;
    user.status = "inactive";
    await user.save();
  },
};
