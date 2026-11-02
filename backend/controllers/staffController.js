import { staffService } from "../services/staffService.js";
import { ServiceError } from "../services/serviceError.js";
import { sendServiceError } from "./controllerError.js";

export const updateStaffById = async (req, res) => {
  try {
    const staff = await staffService.update(req.params.id, req.body, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Staff updated successfully", staff });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const deleteStaffById = async (req, res) => {
  try {
    await staffService.remove(req.params.id, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Staff deleted successfully" });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getStaffById = async (req, res) => {
  const staff = await staffService.getById(req.params.id, req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Staff fetched successfully", staff });
};

export const getAllStaff = async (req, res) => {
  const staffs = await staffService.getAll(req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Staff fetched successfully", staffs });
};

export const getAllStaffCount = async (req, res) => {
  const count = await staffService.count(req.user);
  return res.status(200).json({ response_code: 200, success: true, count });
};

export const getAllActiveStaff = async (req, res) => {
  const staffs = await staffService.getActive(req.user);
  return res.status(200).json({ response_code: 200, success: true, message: "Active staff fetched successfully", staffs });
};

export const getAllStaffsPagination = async (req, res) => {
  try {
    const { staffs, paginationInfo } = await staffService.getPaginated(req.query, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Staff fetched successfully", staffs, paginationInfo });
  } catch (error) {
    if (error instanceof ServiceError) return res.status(error.statusCode).json({ message: error.message });
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const staff = await staffService.updateStatus(req.params.id, req.body?.workStatus, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Staff status updated successfully", staff });
  } catch (error) {
    return sendServiceError(res, error);
  }
};
