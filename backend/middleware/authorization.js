import mongoose from "mongoose";
import Admin from "../models/adminModel.js";
import Client from "../models/clientModel.js";
import Invoice from "../models/invoiceModel.js";
import Staff from "../models/staffModel.js";
import User from "../models/userModel.js";

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

export async function adminScope(req) {
  if (req.user?.role === "superAdmin") return {};
  const adminId = await getAdminProfileId(req.user);
  // Older records stored the owning User id in fields that now reference Admin.
  // Accept that legacy value for the same authenticated admin during migration.
  return adminId
    ? { adminId: { $in: [adminId, req.user._id] } }
    : { adminId: { $in: [] } };
}

export async function jobScope(req) {
  if (req.user?.role === "superAdmin") return {};
  if (req.user?.role === "staff") {
    const staffId = await getStaffProfileId(req.user);
    return staffId ? { assignedStaff: staffId } : { assignedStaff: { $in: [] } };
  }
  return adminScope(req);
}

export function requireOwnedRecord(Model, { param = "id", ownerField = "adminId", ownerType = "admin" } = {}) {
  return async (req, res, next) => {
    const id = req.params[param];
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: `Invalid ${param}` });
    if (req.user?.role === "superAdmin") return next();

    try {
      const scope = ownerType === "staff"
        ? { [ownerField]: await getStaffProfileId(req.user) }
        : ownerType === "job"
          ? await jobScope(req)
          : await adminScope(req);
      if (!Object.values(scope).some(Boolean)) return res.status(403).json({ message: "Access denied" });
      const exists = await Model.exists({ _id: id, ...scope });
      if (!exists) return res.status(404).json({ message: "Record not found" });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const requireSelf = (param = "id") => (req, res, next) => {
  if (String(req.user?._id) !== String(req.params[param])) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};

export const requireUserRecordAccess = (param = "id") => async (req, res, next) => {
  const targetId = req.params[param];
  if (!mongoose.isValidObjectId(targetId)) return res.status(400).json({ message: `Invalid ${param}` });
  if (req.user?.role === "superAdmin" || String(req.user?._id) === String(targetId)) return next();
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Access denied" });

  try {
    const [target, adminId] = await Promise.all([
      User.findById(targetId).select("_id role staffDetails adminDetails"),
      getAdminProfileId(req.user),
    ]);
    if (!target || !adminId || target.role !== "staff") {
      return res.status(404).json({ message: "User not found" });
    }
    const staff = await Staff.exists({ user: target._id, adminId });
    if (!staff) return res.status(404).json({ message: "User not found" });
    return next();
  } catch (error) {
    return next(error);
  }
};

export async function invoiceScope(req) {
  if (req.user?.role === "superAdmin") return {};
  const clients = await Client.distinct("_id", await adminScope(req));
  return { client: { $in: clients } };
}

export const requireInvoiceRecord = (param = "id") => async (req, res, next) => {
  const id = req.params[param];
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: `Invalid ${param}` });
  if (req.user?.role === "superAdmin") return next();
  try {
    const [invoice, scope] = await Promise.all([
      Invoice.findById(id).populate("client", "adminId"),
      adminScope(req),
    ]);
    if (!invoice?.client) return res.status(404).json({ message: "Invoice not found" });
    const ownerIds = scope.adminId?.$in || [];
    if (!ownerIds.some((ownerId) => String(ownerId) === String(invoice.client.adminId))) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
