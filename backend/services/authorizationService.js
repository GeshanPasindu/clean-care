import Client from "../models/clientModel.js";
import RolePermission from "../models/rolePermissionModel.js";
import Role from "../models/roleModel.js";
import User from "../models/userModel.js";
import mongoose from "mongoose";

export const roleScope = (user) => user?.scope || "";

export async function getStaffUserId(user) {
  return roleScope(user) === "staff" && mongoose.isValidObjectId(user?._id) ? user._id : null;
}

export async function getTenantIdForUser(user) {
  if (!user?._id) return null;
  const scope = roleScope(user);
  if (user?.tenantId && mongoose.isValidObjectId(user.tenantId)) return user.tenantId;
  if (scope === "tenant" || scope === "platform") return user._id;
  return null;
}

export async function tenantDataScope(context) {
  const user = context?.user;
  if (roleScope(user) === "platform") return {};
  const tenantId = await getTenantIdForUser(user);
  return tenantId
    ? { tenantId: new mongoose.Types.ObjectId(tenantId) }
    : { tenantId: { $in: [] } };
}

export async function jobScope(context) {
  const user = context?.user;
  const scope = roleScope(user);
  if (scope === "platform") return {};
  if (scope === "staff") {
    const staffId = await getStaffUserId(user);
    return staffId
      ? {
        $or: [
          { assignedStaff: new mongoose.Types.ObjectId(staffId) },
          { "staffAssignments.staff": new mongoose.Types.ObjectId(staffId) },
        ],
      }
      : { assignedStaff: { $in: [] } };
  }
  if (scope === "tenant") {
    const tenantScope = await tenantDataScope(context);
    const staffRoles = await Role.find({ scope: "staff" }).select("_id").lean();
    const staffIds = await User.distinct("_id", {
      ...tenantScope,
      role: { $in: staffRoles.map((role) => role._id) },
      isDeleted: false,
    });
    return {
      $or: [
        tenantScope,
        { assignedStaff: { $in: staffIds } },
        { "staffAssignments.staff": { $in: staffIds } },
      ],
    };
  }
  return tenantDataScope(context);
}

export async function invoiceScope(context) {
  if (roleScope(context?.user) === "platform") return {};
  const clients = await Client.distinct("_id", await tenantDataScope(context));
  return { client: { $in: clients } };
}

export async function getRolePermissionKeys(roleId) {
  if (!roleId) return [];
  const role = await Role.findById(roleId).select("_id isActive").lean();
  if (!role?.isActive) return [];
  const assignments = await RolePermission.find({ role: role._id })
    .populate("permission", "key")
    .lean();
  return assignments.map((assignment) => assignment.permission?.key).filter(Boolean);
}

export function hasPermission(user, permissionKey) {
  return Array.isArray(user?.permissions) && user.permissions.includes(permissionKey);
}
