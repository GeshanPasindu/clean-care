import "dotenv/config";
import mongoose from "mongoose";
import Permission from "../models/permissionModel.js";
import Role from "../models/roleModel.js";
import RolePermission from "../models/rolePermissionModel.js";
import { builtInRoles, permissionCatalog } from "../services/permissionCatalog.js";

try {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is required");
  await mongoose.connect(process.env.MONGO_URI);

  const permissions = new Map();
  for (const [key, name, group, platformOnly = false] of permissionCatalog) {
    const permission = await Permission.findOneAndUpdate(
      { key },
      { $set: { name, group, platformOnly }, $setOnInsert: { key, description: "", isSystem: true } },
      { new: true, upsert: true, runValidators: true }
    );
    permissions.set(key, permission);
  }

  for (const roleDefinition of builtInRoles) {
    const role = await Role.findOneAndUpdate(
      { key: roleDefinition.key },
      {
        $set: {
          name: roleDefinition.name,
          description: roleDefinition.description,
          scope: roleDefinition.scope,
          isSystem: true,
          isActive: true,
        },
        $setOnInsert: { key: roleDefinition.key },
      },
      { new: true, upsert: true, runValidators: true }
    );
    await RolePermission.deleteMany({ role: role._id });
    await RolePermission.insertMany(roleDefinition.permissions.map((key) => ({
      role: role._id,
      permission: permissions.get(key)._id,
    })));
  }

  const currentKeys = permissionCatalog.map(([key]) => key);
  const obsoletePermissions = await Permission.find({ key: { $nin: currentKeys } }).select("_id").lean();
  if (obsoletePermissions.length) {
    const obsoleteIds = obsoletePermissions.map((permission) => permission._id);
    await RolePermission.deleteMany({ permission: { $in: obsoleteIds } });
    await Permission.deleteMany({ _id: { $in: obsoleteIds } });
  }

  console.log(`Seeded ${permissions.size} permissions and ${builtInRoles.length} built-in roles.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
