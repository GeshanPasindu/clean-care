import type { Model, Types } from "mongoose";
import type { HttpHandler } from "../types/http.js";
import { authenticatedUser } from "./validatedController.js";
import mongoose from "mongoose";
import Invoice from "../models/invoiceModel.js";
import User from "../models/userModel.js";
import { requirePermissions } from "./authentication.js";
import { getTenantIdForUser, invoiceScope, jobScope, roleScope, tenantDataScope } from "../services/authorizationService.js";

export { getTenantIdForUser, invoiceScope, jobScope, tenantDataScope };

export function requireOwnedRecord<T extends { _id: Types.ObjectId }>(Model: Model<T>, { param = "id", ownerType = "tenant" }: { param?: string; ownerType?: "tenant" | "job" } = {}): HttpHandler {
  return async (req, res, next) => {
    const id = req.params[param];
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: `Invalid ${param}` });
    try {
      const context = { user: authenticatedUser(req) };
      const scope = ownerType === "job" ? await jobScope(context) : await tenantDataScope(context);
      const exists = await Model.exists({ _id: id, ...scope });
      if (!exists) return res.status(404).json({ message: "Record not found" });
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

export const requireSelf = (param = "id"): HttpHandler => (req, res, next) => {
  if (String(authenticatedUser(req)._id) !== String(req.params[param])) {
    return res.status(403).json({ message: "Access denied" });
  }
  return next();
};

export const requireUserPermission = (param: string, selfPermission: string, otherPermission: string): HttpHandler => (req, res, next) => {
  if (req.params[param] === "self") req.params[param] = String(authenticatedUser(req)._id);
  const isSelf = String(req.params[param]) === String(authenticatedUser(req)._id);
  return requirePermissions(isSelf ? selfPermission : otherPermission)(req, res, next);
};

export const requireUserRecordAccess = (param = "id"): HttpHandler => async (req, res, next) => {
  const targetId = req.params[param];
  if (!mongoose.isValidObjectId(targetId)) return res.status(400).json({ message: `Invalid ${param}` });
  if (String(authenticatedUser(req)._id) === String(targetId)) return next();

  try {
    const [target, tenantId] = await Promise.all([
      User.findOne({ _id: targetId, isDeleted: false }).select("_id tenantId"),
      getTenantIdForUser(authenticatedUser(req)),
    ]);
    if (!target || roleScope(authenticatedUser(req)) !== "platform" && (!tenantId || String(target.tenantId) !== String(tenantId))) {
      return res.status(404).json({ message: "User not found" });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireInvoiceRecord = (param = "id"): HttpHandler => async (req, res, next) => {
  const id = req.params[param];
  if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: `Invalid ${param}` });
  if (roleScope(authenticatedUser(req)) === "platform") return next();
  try {
    const [invoice, scope] = await Promise.all([
      Invoice.findById(id).populate("client", "tenantId"),
      tenantDataScope({ user: authenticatedUser(req) }),
    ]);
    if (!invoice?.client || !("tenantId" in invoice.client)) return res.status(404).json({ message: "Invoice not found" });
    const tenantId = scope.tenantId;
    if (!tenantId || String(tenantId) !== String(invoice.client.tenantId)) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};
