import Admin from "../models/adminModel.js";
import Staff from "../models/staffModel.js";
import User from "../models/userModel.js";
import { ServiceError } from "./serviceError.js";
import { revokeUserSessions } from "./sessionService.js";
import { hashPassword } from "./credentialService.js";

export const adminService = {
  async updatePassword(id, password) {
    if (typeof password !== "string" || password.length < 10 || password.length > 128) {
      throw new ServiceError("Use a password between 10 and 128 characters", 400);
    }
    const adminUser = await User.findOne({ _id: id, role: "admin" }).select("+password");
    if (!adminUser) throw new ServiceError("Admin account not found", 404);
    adminUser.password = await hashPassword(password);
    await adminUser.save();
    await revokeUserSessions(adminUser._id);
  },

  getAll() {
    return User.find({ role: "admin" })
      .select("_id userName email role status createdAt updatedAt adminDetails")
      .populate("adminDetails");
  },

  async updateStatus(id, status) {
    if (!["active", "inactive"].includes(status)) throw new ServiceError("Invalid account status", 400);
    const existingAdmin = await User.findOne({ _id: id, role: "admin" }).select("_id adminDetails");
    if (!existingAdmin) throw new ServiceError("Admin account not found", 404);

    if (status === "inactive") {
      const adminProfile = existingAdmin.adminDetails
        ? await Admin.findById(existingAdmin.adminDetails).select("_id")
        : await Admin.findOne({ user: existingAdmin._id }).select("_id");
      const supervisorIds = [adminProfile?._id, existingAdmin._id].filter(Boolean);
      if (await Staff.exists({ adminId: { $in: supervisorIds } })) {
        throw new ServiceError("Reassign this admin's staff to an active supervisor before deactivating the admin", 409);
      }
    }

    const adminUser = await User.findOneAndUpdate(
      { _id: id, role: "admin" },
      { $set: { status } },
      { new: true, runValidators: true }
    ).select("_id status");
    if (!adminUser) throw new ServiceError("Admin account not found", 404);
    if (status === "inactive") await revokeUserSessions(adminUser._id);
    return adminUser;
  },
};
