import validator from "validator";
import Client from "../models/clientModel.js";
import Job from "../models/jobModel.js";
import Role from "../models/roleModel.js";
import User from "../models/userModel.js";
import { hashPassword } from "./credentialService.js";
import { getRolePermissionKeys, roleScope } from "./authorizationService.js";
import { ServiceError } from "./serviceError.js";
import { revokeUserSessions } from "./sessionService.js";

const profileFields = ["firstName", "lastName", "address", "phoneNumber", "dateOfBirth", "position"];
const employeeFields = [
  "dateOfHire", "empContactName", "empPhoneNumber", "bankAcNo", "bankName", "bankAcBranch", "payFrequency", "notes",
];
const bankFields = ["bankAcNo", "bankName", "bankAcBranch"];
const dateFields = ["dateOfBirth", "dateOfHire"];
const selfEditableFields = [
  ...profileFields, "userName", "email", "empContactName", "empPhoneNumber", "bankAcNo", "bankName", "bankAcBranch",
];
const readableFields = [
  "_id", "userName", "email", "role", "status", "firstName", "lastName", "address", "phoneNumber", "dateOfBirth",
  "position", "dateOfHire", "empContactName", "empPhoneNumber", "bankAcNo", "bankName", "bankAcBranch", "payFrequency",
  "notes", "activeJob", "tenantId", "isDeleted", "deletedAt", "deletedBy", "createdAt", "updatedAt",
].join(" ");
const validId = (value) => validator.isMongoId(String(value || ""));
const parsePage = (value, fallback, max) => {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const fieldsFrom = (source = {}, fields) => Object.fromEntries(
  fields.filter((field) => source[field] !== undefined).map((field) => [
    field,
    dateFields.includes(field) && source[field] === "" ? null : source[field],
  ])
);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

async function findRole(roleId) {
  if (!validId(roleId)) throw new ServiceError("Select a valid role", 400);
  const role = await Role.findOne({ _id: roleId, isActive: true });
  if (!role) throw new ServiceError("Role not found or inactive", 404);
  return role;
}

async function assertRoleAssignable(role, actor) {
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

async function populateRole(user) {
  if (user.role && typeof user.role === "object" && user.role.key) return user.role;
  return Role.findById(user.role?._id || user.role).select("key name scope isActive").lean();
}

async function presentUser(user, actor, { includePermissions = true } = {}) {
  const role = await populateRole(user);
  if (!role) return null;
  const result = user.toObject ? user.toObject() : { ...user };
  delete result.password;
  result.roleId = String(role._id);
  result.role = role.key;
  result.roleName = role.name;
  result.scope = role.scope;
  result.isPlatformAdmin = role.scope === "platform";
  if (result.tenantId) result.tenantId = String(result.tenantId);
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

function tenantFilter(actor) {
  if (roleScope(actor) === "platform") return {};
  const tenantId = actor?.tenantId || (roleScope(actor) === "tenant" ? actor?._id : null);
  return tenantId ? { tenantId } : { _id: actor?._id };
}

async function findManagedUser(id, actor, { includeDeleted = false } = {}) {
  if (!validId(id)) throw new ServiceError("Invalid user id", 400);
  const user = await User.findOne({
    _id: id,
    ...tenantFilter(actor),
    ...(includeDeleted ? {} : { isDeleted: false }),
  }).populate("role", "key name scope isActive");
  if (!user) throw new ServiceError("User not found", 404);
  if (user.role?.scope === "platform" && String(user._id) !== String(actor?._id)) {
    throw new ServiceError("Platform accounts cannot be managed through this endpoint", 403);
  }
  return user;
}

async function normalizeEmail(email, currentUserId = null) {
  if (typeof email !== "string" || !validator.isEmail(email.trim())) throw new ServiceError("Enter a valid email address", 400);
  const normalized = email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalized, ...(currentUserId ? { _id: { $ne: currentUserId } } : {}) }).select("_id").lean();
  if (existing) throw new ServiceError("An account with this email already exists", 409);
  return normalized;
}

async function validateTenantSupervisor(id) {
  if (!validId(id)) throw new ServiceError("Select a valid supervisor account", 400);
  const user = await User.findOne({ _id: id, status: "active", isDeleted: false }).populate("role", "scope");
  if (!user || user.role?.scope !== "tenant") throw new ServiceError("Select an active tenant administrator account", 400);
  return user;
}

async function assignedTenantForCreate(role, body, actor) {
  if (role.scope === "tenant") return null;
  if (roleScope(actor) === "platform") return (await validateTenantSupervisor(body.tenantId))?._id;
  if (roleScope(actor) === "tenant") return actor._id;
  throw new ServiceError("Only tenant administrators can create staff accounts", 403);
}

function checkAccountBody(body) {
  if (typeof body.userName !== "string" || !body.userName.trim() || body.userName.trim().length > 120) {
    throw new ServiceError("Enter a valid user name", 400);
  }
  if (body.userName !== undefined && !String(body.userName).trim()) throw new ServiceError("User name cannot be empty", 400);
  for (const field of ["firstName", "lastName", "address", "phoneNumber", "position", "bankAcNo", "bankName", "bankAcBranch", "empContactName", "empPhoneNumber", "notes"]) {
    if (body[field] !== undefined && typeof body[field] !== "string") throw new ServiceError(`${field} must be text`, 400);
  }
  for (const field of dateFields) {
    if (body[field] !== undefined && body[field] !== "" && !Number.isFinite(new Date(body[field]).getTime())) {
      throw new ServiceError(`${field} must be a valid date`, 400);
    }
  }
  if (body.payFrequency !== undefined && !["Weekly", "Monthly"].includes(body.payFrequency)) {
    throw new ServiceError("Choose a valid pay frequency", 400);
  }
}

export const userService = {
  async create(body = {}, actor) {
    if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 128) {
      throw new ServiceError("Passwords must be between 10 and 128 characters", 400);
    }
    checkAccountBody(body);
    const email = await normalizeEmail(body.email);
    let role;
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

    try {
      const user = await User.create({
        ...accountData,
        userName: body.userName.trim(),
        email,
        password: await hashPassword(body.password),
        role: role._id,
        status: "active",
        tenantId,
      });
      if (role.scope === "tenant") {
        user.tenantId = user._id;
        await user.save();
      }
      return presentUser(user, actor);
    } catch (error) {
      if (error?.code === 11000) throw new ServiceError("An account with this email already exists", 409);
      throw error;
    }
  },

  async getById(id, actor) {
    const user = await findManagedUser(id, actor);
    return presentUser(user, actor);
  },

  async getMe(actor) {
    const user = await User.findOne({ _id: actor._id, isDeleted: false }).select(readableFields).populate("role", "key name scope isActive");
    if (!user) throw new ServiceError("User not found", 404);
    return presentUser(user, actor);
  },

  async getAll(actor, { scope, roleId, status, search = "", page: rawPage, limit: rawLimit } = {}) {
    if (typeof search !== "string") throw new ServiceError("Invalid user search", 400);
    const filter = { ...tenantFilter(actor), isDeleted: false };
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
      User.find(filter).select(readableFields).populate("role", "key name scope isActive")
        .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ]);
    return {
      users: await Promise.all(users.map((user) => presentUser(user, actor))),
      paginationInfo: { totalResult, totalPages: Math.ceil(totalResult / limit), currentPage: page, pageSize: limit },
    };
  },

  async count(actor, scope = "employees") {
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

  async getDeleted(actor, { page: rawPage, limit: rawLimit } = {}) {
    const filter = { ...tenantFilter(actor), isDeleted: true };
    const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePage(rawLimit, 25, 100);
    const [totalResult, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
      .select(readableFields)
      .populate("role", "key name scope isActive")
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

  async update(id, body = {}, actor) {
    const user = await findManagedUser(id, actor);
    if (body.roleId !== undefined || body.tenantId !== undefined) {
      throw new ServiceError("Use the role assignment action to change a user's role or supervisor", 400);
    }
    checkAccountBody({ ...body, userName: body.userName ?? user.userName });
    const isSelf = String(user._id) === String(actor?._id);
    if (!isSelf && !actor.permissions?.includes("users.bank.update") && bankFields.some((field) => body[field] !== undefined)) {
      throw new ServiceError("You are not allowed to update user bank details", 403);
    }
    const updates = fieldsFrom(body, [...profileFields, ...employeeFields]);
    if (body.userName !== undefined) updates.userName = body.userName.trim();
    if (body.email !== undefined) updates.email = await normalizeEmail(body.email, user._id);

    Object.assign(user, updates);
    try {
      await user.save();
    } catch (error) {
      if (error?.code === 11000) throw new ServiceError("An account with this email already exists", 409);
      throw error;
    }
    return presentUser(user, actor);
  },

  async changeRole(id, { roleId, tenantId } = {}, actor) {
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

    user.role = nextRole._id;
    await user.save();
    return presentUser(user, actor);
  },

  async updateSelf(actor, body = {}) {
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
    ).select(readableFields).populate("role", "key name scope isActive");
    if (!user) throw new ServiceError("User not found", 404);
    return presentUser(user, actor);
  },

  async updateStatus(id, status, actor) {
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

  async resetPassword(id, password, actor) {
    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
      throw new ServiceError("Use a password between 10 and 128 characters", 400);
    }
    const user = await findManagedUser(id, actor);
    if (String(user._id) === String(actor?._id)) {
      throw new ServiceError("Use the current-password change endpoint for your own account", 403);
    }
    user.password = await hashPassword(password);
    await user.save();
    await revokeUserSessions(user._id);
  },

  async remove(id, actor) {
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
    user.deletedBy = actor._id;
    user.activeJob = null;
    await user.save();
    await revokeUserSessions(user._id);
  },

  async restore(id, actor) {
    if (!validId(id)) throw new ServiceError("Invalid user id", 400);
    const user = await User.findOne({ _id: id, ...tenantFilter(actor), isDeleted: true }).populate("role", "scope isActive");
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
