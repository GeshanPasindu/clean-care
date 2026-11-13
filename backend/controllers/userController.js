import { authService } from "../services/authService.js";
import { clearRefreshCookie } from "../config/authCookie.js";
import { userService } from "../services/userService.js";
import { sendServiceError } from "./controllerError.js";

export const createUser = async (req, res) => {
  try {
    const user = await userService.create(req.body, req.user);
    return res.status(201).json({ success: true, message: "User created successfully", user });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await userService.getById(req.params.id, req.user);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await userService.getMe(req.user);
    return res.status(200).json({ success: true, user });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const result = await userService.getAll(req.user, req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getUserCount = async (req, res) => {
  try {
    const count = await userService.count(req.user, req.query.scope);
    return res.status(200).json({ success: true, count });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getDeletedUsers = async (req, res) => {
  try {
    const result = await userService.getDeleted(req.user, req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await userService.update(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "User updated successfully", user });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const changeUserRole = async (req, res) => {
  try {
    const user = await userService.changeRole(req.params.id, req.body, req.user);
    return res.status(200).json({ success: true, message: "User role updated successfully", user });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const updateMe = async (req, res) => {
  try {
    const user = await userService.updateSelf(req.user, req.body);
    return res.status(200).json({ success: true, message: "Profile updated successfully", user });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const user = await userService.updateStatus(req.params.id, req.body?.status, req.user);
    return res.status(200).json({ success: true, message: "Account status updated", user });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    await userService.resetPassword(req.params.id, req.body?.password, req.user);
    return res.status(200).json({ success: true, message: "Password updated. The user must sign in again." });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const changeOwnPassword = async (req, res, next) => {
  try {
    await authService.changePassword(req.user._id, req.body?.currentPassword, req.body?.newPassword);
    clearRefreshCookie(res);
    return res.status(200).json({ success: true, message: "Password updated. Please sign in again." });
  } catch (error) {
    return next(error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    await userService.remove(req.params.id, req.user);
    return res.status(200).json({ success: true, message: "User soft-deleted successfully" });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const restoreUser = async (req, res) => {
  try {
    await userService.restore(req.params.id, req.user);
    return res.status(200).json({ success: true, message: "User restored in inactive status" });
  } catch (error) {
    return sendServiceError(res, error);
  }
};
