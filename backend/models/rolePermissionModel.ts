import type { RolePermissionRecord } from "../types/models.js";
import mongoose from "mongoose";

const { Schema } = mongoose;

const rolePermissionSchema = new Schema<RolePermissionRecord>({
  role: { type: Schema.Types.ObjectId, ref: "Role", required: true },
  permission: { type: Schema.Types.ObjectId, ref: "Permission", required: true },
  grantedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

rolePermissionSchema.index({ role: 1, permission: 1 }, { unique: true });
rolePermissionSchema.index({ permission: 1, role: 1 });

export default mongoose.model<RolePermissionRecord>("RolePermission", rolePermissionSchema);
