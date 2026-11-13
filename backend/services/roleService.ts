import type { AuthenticatedUser, EntityId } from "../types/domain.js";
import type { RoleRecord, PermissionRecord } from "../types/models.js";
import type { CreateRoleInput, UpdateRoleInput } from "../types/requests.js";
import { errorCode } from "../utils/errors.js";
import mongoose from "mongoose";
import Permission from "../models/permissionModel.js";
import Role from "../models/roleModel.js";
import RolePermission from "../models/rolePermissionModel.js";
import User from "../models/userModel.js";
import { ServiceError } from "./serviceError.js";

const normalizeKey = (value: string) => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 64);

async function permissionRecords(permissionKeys: string[], actor: AuthenticatedUser) {
  if (!Array.isArray(permissionKeys) || permissionKeys.some((key) => typeof key !== "string")) {
    throw new ServiceError("Choose a valid permission list", 400);
  }
  const uniqueKeys = [...new Set(permissionKeys)];
  const permissions = await Permission.find({ key: { $in: uniqueKeys } });
  if (permissions.length !== uniqueKeys.length) throw new ServiceError("One or more permissions do not exist", 400);
  if (!actor.isPlatformAdmin && permissions.some((permission) => permission.platformOnly)) {
    throw new ServiceError("Only a platform administrator can grant platform permissions", 403);
  }
  return permissions;
}

async function replaceRolePermissions(role: RoleRecord, permissions: PermissionRecord[], grantedBy: AuthenticatedUser) {
  await RolePermission.deleteMany({ role: role._id });
  if (permissions.length) {
    await RolePermission.insertMany(permissions.map((permission) => ({
      role: role._id,
      permission: permission._id,
      grantedBy: grantedBy?._id || null,
    })));
  }
}

export const roleService = {
  async getRoles({ includeInactive = false }: { includeInactive?: boolean } = {}) {
    const query = includeInactive ? {} : { isActive: true };
    const roles = await Role.find(query).sort({ scope: 1, name: 1 }).lean();
    if (!roles.length) return [];
    const assignments = await RolePermission.find({ role: { $in: roles.map((role) => role._id) } })
      .populate("permission", "key name description group")
      .lean();
    const permissionsByRole = new Map<string, PermissionRecord[]>();
    for (const assignment of assignments) {
      if (!assignment.permission || !("key" in assignment.permission)) continue;
      const key = String(assignment.role);
      const permissions = permissionsByRole.get(key) || [];
      permissions.push(assignment.permission);
      permissionsByRole.set(key, permissions);
    }
    return roles.map((role) => ({
      ...role,
      permissions: permissionsByRole.get(String(role._id)) || [],
    }));
  },

  async getAssignableRoles(actor: AuthenticatedUser) {
    const roles = await this.getRoles();
    const actorPermissions = new Set(actor?.permissions || []);
    return roles.filter((role) => {
      if (role.scope === "platform") return false;
      if (actor?.scope !== "platform" && role.scope !== "staff") return false;
      return actor?.scope === "platform"
        || role.permissions.every((permission) => actorPermissions.has(permission.key));
    });
  },

  getPermissions() {
    return Permission.find().sort({ group: 1, name: 1 }).lean();
  },

  async create(body: CreateRoleInput, actor: AuthenticatedUser) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const key = normalizeKey(body.key || name);
    const scope = body.scope;
    if (!name || !key || !["tenant", "staff"].includes(scope)) {
      throw new ServiceError("Provide a role name and a tenant or staff scope", 400);
    }
    const permissions = await permissionRecords(body.permissionKeys || [], actor);
    let role: mongoose.HydratedDocument<RoleRecord>;
    try {
      role = await Role.create({ key, name, description: body.description || "", scope });
    } catch (error) {
      if (errorCode(error) === 11000) throw new ServiceError("A role with this name or key already exists", 409);
      throw error;
    }
    try {
      await replaceRolePermissions(role, permissions, actor);
      return (await this.getRoles()).find((item) => String(item._id) === String(role._id));
    } catch (error) {
      await RolePermission.deleteMany({ role: role._id });
      await Role.deleteOne({ _id: role._id });
      throw error;
    }
  },

  async update(id: string, body: UpdateRoleInput, actor: AuthenticatedUser) {
    if (!mongoose.isValidObjectId(id)) throw new ServiceError("Invalid role id", 400);
    const role = await Role.findById(id);
    if (!role) throw new ServiceError("Role not found", 404);
    if (role.scope === "platform") throw new ServiceError("The platform administrator role cannot be edited here", 403);
    const permissions = body.permissionKeys === undefined
      ? null
      : await permissionRecords(body.permissionKeys, actor);

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || !body.name.trim()) throw new ServiceError("Role name is required", 400);
      role.name = body.name.trim();
    }
    if (body.description !== undefined) role.description = String(body.description).trim();
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") throw new ServiceError("Invalid role status", 400);
      if (!body.isActive && role.isSystem) throw new ServiceError("System roles cannot be deactivated", 403);
      if (!body.isActive && await User.exists({ role: role._id })) {
        throw new ServiceError("Reassign users before deactivating this role", 409);
      }
      role.isActive = body.isActive;
    }
    await role.save();

    if (permissions) await replaceRolePermissions(role, permissions, actor);
    return (await this.getRoles({ includeInactive: true })).find((item) => String(item._id) === String(role._id));
  },

  async remove(id: string) {
    if (!mongoose.isValidObjectId(id)) throw new ServiceError("Invalid role id", 400);
    const role = await Role.findById(id);
    if (!role) throw new ServiceError("Role not found", 404);
    if (role.isSystem || role.scope === "platform") throw new ServiceError("System roles cannot be deleted", 403);
    if (await User.exists({ role: role._id })) {
      throw new ServiceError("Reassign users before deleting this role", 409);
    }
    role.isActive = false;
    await role.save();
  },

  async getPermissionKeys(roleId: EntityId) {
    const assignments = await RolePermission.find({ role: roleId }).populate("permission", "key").lean();
    return assignments.flatMap(({ permission }) => permission && "key" in permission ? [permission.key] : []);
  },
};
