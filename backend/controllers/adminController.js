import { adminService } from "../services/adminService.js";
import { sendServiceError } from "./controllerError.js";

export const updateAdminPassword = async (req, res) => {
  try {
    await adminService.updatePassword(req.params.id, req.body?.password);
    return res.status(200).json({ response_code: 200, success: true, message: "Password updated. The admin must sign in again." });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const admins = await adminService.getAll();
    return res.status(200).json({ response_code: 200, success: true, message: "Admin data fetched successfully", admins });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const adminUser = await adminService.updateStatus(req.params.id, req.body?.status);
    return res.status(200).json({ response_code: 200, success: true, message: "Admin updated successfully", status: adminUser.status });
  } catch (error) {
    return sendServiceError(res, error);
  }
};
