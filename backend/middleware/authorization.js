import mongoose from "mongoose";
import Invoice from "../models/invoiceModel.js";
import Staff from "../models/staffModel.js";
import User from "../models/userModel.js";
import { adminScope, getAdminProfileId, getStaffProfileId, invoiceScope, jobScope } from "../services/authorizationService.js";

export { adminScope, getAdminProfileId, getStaffProfileId, invoiceScope, jobScope };

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
