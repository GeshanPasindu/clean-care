import argon2 from "argon2";
import Admin from "../models/adminModel.js";
import Staff from "../models/staffModel.js";
import User from "../models/userModel.js";
import RefreshSession from "../models/refreshSessionModel.js";
import RefreshToken from "../models/refreshTokenModel.js";

const hashPassword = (password) => argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});

async function revokeUserSessions(userId) {
  const now = new Date();
  const sessions = await RefreshSession.find({ user: userId, revokedAt: null }).select("familyId");
  const familyIds = sessions.map((session) => session.familyId);
  await Promise.all([
    RefreshSession.updateMany({ user: userId, revokedAt: null }, { $set: { revokedAt: now } }),
    familyIds.length
      ? RefreshToken.updateMany({ familyId: { $in: familyIds }, consumedAt: null }, { $set: { consumedAt: now } })
      : Promise.resolve(),
  ]);
}

export const updateAdminPassword = async (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== "string" || password.length < 10 || password.length > 128) {
    return res.status(400).json({ message: "Use a password between 10 and 128 characters" });
  }

  try {
    const adminUser = await User.findOne({ _id: req.params.id, role: "admin" }).select("+password");
    if (!adminUser) return res.status(404).json({ message: "Admin account not found" });
    adminUser.password = await hashPassword(password);
    await adminUser.save();
    await revokeUserSessions(adminUser._id);
    return res.status(200).json({ response_code: 200, success: true, message: "Password updated. The admin must sign in again." });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" })
      .select("_id userName email role status createdAt updatedAt adminDetails")
      .populate("adminDetails");
    return res.status(200).json({ response_code: 200, success: true, message: "Admin data fetched successfully", admins });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updateStatus = async (req, res) => {
  const { status } = req.body || {};
  if (!["active", "inactive"].includes(status)) return res.status(400).json({ message: "Invalid account status" });

  try {
    const existingAdmin = await User.findOne({ _id: req.params.id, role: "admin" }).select("_id adminDetails");
    if (!existingAdmin) return res.status(404).json({ message: "Admin account not found" });
    if (status === "inactive") {
      const adminProfile = existingAdmin.adminDetails
        ? await Admin.findById(existingAdmin.adminDetails).select("_id")
        : await Admin.findOne({ user: existingAdmin._id }).select("_id");
      const supervisorIds = [adminProfile?._id, existingAdmin._id].filter(Boolean);
      if (await Staff.exists({ adminId: { $in: supervisorIds } })) {
        return res.status(409).json({ message: "Reassign this admin's staff to an active supervisor before deactivating the admin" });
      }
    }

    const adminUser = await User.findOneAndUpdate(
      { _id: req.params.id, role: "admin" },
      { $set: { status } },
      { new: true, runValidators: true }
    ).select("_id status");
    if (!adminUser) return res.status(404).json({ message: "Admin account not found" });
    if (status === "inactive") await revokeUserSessions(adminUser._id);
    return res.status(200).json({ response_code: 200, success: true, message: "Admin updated successfully", status });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

