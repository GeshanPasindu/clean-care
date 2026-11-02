import { userService } from "../services/userService.js";
import { sendServiceError } from "./controllerError.js";

export const addUser = async (req, res) => {
  try {
    await userService.create(req.body, req.user);
    return res.status(201).json({ response_code: 201, success: true, message: "User registered successfully" });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getUser = async (req, res) => {
  try {
    const userDetails = await userService.getById(req.params.id);
    return res.status(200).json({ response_code: 200, success: true, message: "User fetched successfully", userDetails });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await userService.updateSelf(req.user, req.body);
    return res.status(200).json({ response_code: 200, success: true, message: "User updated successfully", user });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await userService.getAll();
    return res.status(200).json({ response_code: 200, success: true, message: "Users fetched successfully", users });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    await userService.remove(req.params.id, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "User deleted successfully" });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const updateStaff = async (req, res) => {
  try {
    await userService.updateStaff(req.params.id, req.body, req.user);
    return res.status(200).json({ response_code: 200, success: true, message: "Staff details updated successfully" });
  } catch (error) {
    return sendServiceError(res, error);
  }
};

export const updateAdmin = async (req, res) => {
  try {
    await userService.updateAdmin(req.params.id, req.body);
    return res.status(200).json({ response_code: 200, success: true, message: "Admin details updated successfully" });
  } catch (error) {
    return sendServiceError(res, error);
  }
};
