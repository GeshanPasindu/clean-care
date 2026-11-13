import { roleService } from "../services/roleService.js";
import { sendServiceError } from "./controllerError.js";

export const getRoles = async (req, res) => {
  try {
    const roles = await roleService.getRoles({ includeInactive: req.query.includeInactive === "true" });
    return res.status(200).json({ success: true, roles });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getAssignableRoles = async (req, res) => {
  try {
    const roles = await roleService.getAssignableRoles(req.user);
    return res.status(200).json({ success: true, roles });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getPermissions = async (req, res) => {
  try {
    const permissions = await roleService.getPermissions();
    return res.status(200).json({ success: true, permissions });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const createRole = async (req, res) => {
  try {
    const role = await roleService.create(req.body, req.user);
    return res.status(201).json({ success: true, message: "Role created successfully", role });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const updateRole = async (req, res) => {
  try {
    const role = await roleService.update(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "Role updated successfully", role });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const deleteRole = async (req, res) => {
  try {
    await roleService.remove(req.params.id);
    return res.status(200).json({ success: true, message: "Role deactivated successfully" });
  } catch (error) {
    return sendServiceError(res, error);
  }
};
