import "dotenv/config";
import mongoose from "mongoose";
import { databaseUri } from "../config/environment.js";
import Permission from "../models/permissionModel.js";
import Role from "../models/roleModel.js";
import RolePermission from "../models/rolePermissionModel.js";
import { permissionCatalog } from "../services/permissionCatalog.js";
import { errorMessage } from "../utils/errors.js";

// Add the new permissions without replacing existing/custom role assignments.
try {
  await mongoose.connect(databaseUri());
  const superadmin = await Role.findOne({
    key: "superadmin",
    scope: "platform",
  });
  if (!superadmin)
    throw new Error(
      "Create the access-control roles before adding payment permissions",
    );
  for (const [key, name, group] of permissionCatalog.filter(([key]) =>
    key.startsWith("salaries."),
  )) {
    const permission = await Permission.findOneAndUpdate(
      { key },
      {
        $set: { name, group, platformOnly: false },
        $setOnInsert: { key, description: "", isSystem: true },
      },
      { new: true, upsert: true, runValidators: true },
    );
    await RolePermission.updateOne(
      { role: superadmin._id, permission: permission._id },
      { $setOnInsert: { role: superadmin._id, permission: permission._id } },
      { upsert: true },
    );
  }
  const ownPayments = await Permission.findOne({ key: "payroll.self.read" });
  if (ownPayments) {
    const platformRoles = await Role.find({ scope: "platform" }).select("_id");
    await RolePermission.deleteMany({
      role: { $in: platformRoles.map((role) => role._id) },
      permission: ownPayments._id,
    });
  }
  console.log(
    "Added supervisor salary permissions to Super Admin. Other role assignments are preserved.",
  );
} catch (error) {
  console.error(errorMessage(error));
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
