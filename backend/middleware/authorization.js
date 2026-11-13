import mongoose from "mongoose";
import Invoice from "../models/invoiceModel.js";
import User from "../models/userModel.js";
import { requirePermissions } from "./authentication.js";
import { getTenantIdForUser, invoiceScope, jobScope, roleScope, tenantDataScope } from "../services/authorizationService.js";

export { getTenantIdForUser, invoiceScope, jobScope, tenantDataScope };

export function requireOwnedRecord(Model, { param = "id", ownerType = "tenant" } = {}) {
  return async (req, res, next) => {
    const id = req.params[param];
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: `Invalid ${param}` });
    try {
      const scope = ownerType === "job" ? await jobScope(req) : await tenantDataScope(req);
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

export const requireUserPermission = (param, selfPermission, otherPermission) => (req, res, next) => {
  if (req.params[param] === "self") req.params[param] = String(req.user._id);
  const isSelf = String(req.params[param]) === String(req.user._id);
  return requirePermissions(isSelf ? selfPermission : otherPermission)(req, res, next);
};

export const requireUserRecordAccess = (param = "id") => async (req, res, next) => {
  const targetId = req.params[param];
  if (!mongoose.isValidObjectId(targetId)) return res.status(400).json({ message: `Invalid ${param}` });
  if (String(req.user?._id) === String(targetId)) return next();

  try {
    const [target, tenantId] = await Promise.all([
      User.findOne({ _id: targetId, isDeleted: false }).select("_id tenantId"),
      getTenantIdForUser(req.user),
    ]);
    if (!target || roleScope(req.user) !== "platform" && (!tenantId || String(target.tenantId) !== String(tenantId))) {
      return res.status(404).json({ message: "User not found" });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireInvoiceRecord = (param = "id") => async (req, res, next) => {
  const id = req.params[param];
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: `Invalid ${param}` });
  if (roleScope(req.user) === "platform") return next();
  try {
    const [invoice, scope] = await Promise.all([
      Invoice.findById(id).populate("client", "tenantId"),
      tenantDataScope(req),
    ]);
    if (!invoice?.client) return res.status(404).json({ message: "Invoice not found" });
    const tenantId = scope.tenantId;
    if (!tenantId || String(tenantId) !== String(invoice.client.tenantId)) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
