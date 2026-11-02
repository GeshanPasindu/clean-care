import Admin from "../models/adminModel.js";
import Client from "../models/clientModel.js";
import Staff from "../models/staffModel.js";
import mongoose from "mongoose";

export async function getAdminProfileId(user) {
  if (user?.adminDetails && mongoose.isValidObjectId(user.adminDetails)) {
    return user.adminDetails;
  }
  if (!user?._id) return null;
  const admin = await Admin.findOne({ user: user._id }).select("_id");
  return admin?._id || null;
}

export async function getStaffProfileId(user) {
  if (user?.staffDetails && mongoose.isValidObjectId(user.staffDetails)) {
    return user.staffDetails;
  }
  if (!user?._id) return null;
  const staff = await Staff.findOne({ user: user._id }).select("_id");
  return staff?._id || null;
}

export async function adminScope(context) {
  if (context.user?.role === "superAdmin") return {};
  const adminId = await getAdminProfileId(context.user);
  // Older records stored the owning User id in fields that now reference Admin.
  // Accept that legacy value for the same authenticated admin during migration.
  return adminId
    ? { adminId: { $in: [adminId, context.user._id] } }
    : { adminId: { $in: [] } };
}

export async function jobScope(context) {
  if (context.user?.role === "superAdmin") return {};
  if (context.user?.role === "staff") {
    const staffId = await getStaffProfileId(context.user);
    return staffId ? { assignedStaff: staffId } : { assignedStaff: { $in: [] } };
  }
  return adminScope(context);
}

export async function invoiceScope(context) {
  if (context.user?.role === "superAdmin") return {};
  const clients = await Client.distinct("_id", await adminScope(context));
  return { client: { $in: clients } };
}
