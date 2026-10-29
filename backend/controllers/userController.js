import argon2 from "argon2";
import validator from "validator";
import User from "../models/userModel.js";
import Admin from "../models/adminModel.js";
import Staff from "../models/staffModel.js";
import RefreshSession from "../models/refreshSessionModel.js";
import RefreshToken from "../models/refreshTokenModel.js";
import { adminScope, getAdminProfileId } from "../middleware/authorization.js";

const hashPassword = (password) => argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
});
const safeUserFields = "_id userName email role status adminDetails staffDetails superAdminDetails createdAt updatedAt";
const staffFields = [
  "firstName", "lastName", "address", "phoneNumber", "position", "dateOfBirth", "dateOfHire",
  "empContactName", "empPhoneNumber", "bankAcNo", "bankName", "bankAcBranch", "notes", "workStatus", "payFrequency",
];
const validId = (id) => validator.isMongoId(String(id || ""));

async function findActiveAdminSupervisor(id) {
  if (!validId(id)) return null;
  const admin = await Admin.findById(id).populate({
    path: "user",
    match: { role: "admin", status: "active" },
    select: "_id role status",
  });
  return admin?.user ? admin : null;
}

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

export const addUser = async (req, res) => {
  const { email, password, userName, role, staffDetails = {}, adminDetails = {} } = req.body || {};
  let createdUser;
  try {
    if (typeof email !== "string" || typeof userName !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Email, user name, and password are required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = userName.trim();
    if (!validator.isEmail(normalizedEmail) || normalizedName.length < 1 || normalizedName.length > 120) {
      return res.status(400).json({ message: "Enter a valid email and user name" });
    }
    if (password.length < 10 || password.length > 128) {
      return res.status(400).json({ message: "Passwords must be between 10 and 128 characters" });
    }
    if (role === "superAdmin") {
      return res.status(403).json({ message: "The single superAdmin account is provisioned through the local bootstrap command" });
    }
    if (!["admin", "staff"].includes(role)) return res.status(400).json({ message: "Invalid account role" });
    if (role === "admin" && req.user.role !== "superAdmin") {
      return res.status(403).json({ message: "Only a superAdmin can create admin accounts" });
    }
    if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: "An account with this email already exists" });

    const ownAdminId = req.user.role === "admin" ? await getAdminProfileId(req.user) : null;
    if (req.user.role === "admin" && !ownAdminId) {
      return res.status(403).json({ message: "An admin profile is required to create accounts" });
    }

    let staffAdminId = ownAdminId;
    if (role === "staff") {
      if (!staffDetails || typeof staffDetails !== "object" || Array.isArray(staffDetails)) {
        return res.status(400).json({ message: "Staff details are required" });
      }
      if (req.user.role === "superAdmin") {
        const supervisor = await findActiveAdminSupervisor(staffDetails.supervisorId);
        if (!supervisor) return res.status(400).json({ message: "Select an active admin as the staff supervisor" });
        staffAdminId = supervisor._id;
      }
    }

    createdUser = await User.create({
      userName: normalizedName,
      password: await hashPassword(password),
      email: normalizedEmail,
      role,
      status: "active",
    });

    if (role === "admin") {
      const profile = await Admin.create({
        user: createdUser._id,
        firstName: typeof adminDetails.firstName === "string" ? adminDetails.firstName.trim() : undefined,
        lastName: typeof adminDetails.lastName === "string" ? adminDetails.lastName.trim() : undefined,
        position: typeof adminDetails.position === "string" ? adminDetails.position.trim() : undefined,
      });
      createdUser.adminDetails = profile._id;
    } else {
      const profileFields = Object.fromEntries(
        staffFields.filter((field) => staffDetails[field] !== undefined).map((field) => [field, staffDetails[field]])
      );
      const profile = await Staff.create({ ...profileFields, user: createdUser._id, adminId: staffAdminId });
      createdUser.staffDetails = profile._id;
    }
    await createdUser.save();
    return res.status(201).json({ response_code: 201, success: true, message: "User registered successfully" });
  } catch (error) {
    if (createdUser) {
      await Promise.all([
        Admin.deleteOne({ user: createdUser._id }),
        Staff.deleteOne({ user: createdUser._id }),
        User.deleteOne({ _id: createdUser._id }),
      ]);
    }
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select(safeUserFields)
      .populate("adminDetails")
      .populate({
        path: "staffDetails",
        populate: {
          path: "adminId",
          select: "_id firstName lastName user",
          populate: { path: "user", select: "_id userName" },
        },
      })
      .populate("superAdminDetails");
    if (!user) return res.status(404).json({ message: "User not found" });
    const userDetails = user.toObject();
    const supervisor = userDetails.staffDetails?.adminId;
    if (supervisor && typeof supervisor === "object") {
      const supervisorName = [supervisor.firstName, supervisor.lastName].filter(Boolean).join(" ") || supervisor.user?.userName || "";
      userDetails.supervisor = { id: String(supervisor._id), name: supervisorName };
      userDetails.supervisorName = supervisorName;
    }
    return res.status(200).json({ response_code: 200, success: true, message: "User fetched successfully", userDetails });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updateUser = async (req, res) => {
  const { userName, email } = req.body || {};
  if (typeof userName !== "string" || typeof email !== "string") {
    return res.status(400).json({ message: "User name and email are required" });
  }
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedName = userName.trim();
  if (!validator.isEmail(normalizedEmail) || !normalizedName || normalizedName.length > 120) {
    return res.status(400).json({ message: "Enter a valid email and user name" });
  }
  try {
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id },
      { $set: { userName: normalizedName, email: normalizedEmail } },
      { new: true, runValidators: true }
    ).select(safeUserFields);
    if (!updatedUser) return res.status(404).json({ message: "User not found" });
    return res.status(200).json({ response_code: 200, success: true, message: "User updated successfully", user: updatedUser });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select(safeUserFields).populate("adminDetails staffDetails superAdminDetails");
    return res.status(200).json({ response_code: 200, success: true, message: "Users fetched successfully", users });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const deleteUser = async (req, res) => {
  const { id } = req.params;
  if (!validId(id)) return res.status(400).json({ message: "Invalid user id" });
  if (String(req.user._id) === String(id)) return res.status(400).json({ message: "You cannot delete your own account" });
  try {
    const user = await User.findById(id).select("_id role adminDetails");
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") {
      const adminProfile = user.adminDetails
        ? await Admin.findById(user.adminDetails).select("_id")
        : await Admin.findOne({ user: user._id }).select("_id");
      const supervisorIds = [adminProfile?._id, user._id].filter(Boolean);
      if (await Staff.exists({ adminId: { $in: supervisorIds } })) {
        return res.status(409).json({ message: "Reassign this admin's staff before deleting the admin account" });
      }
    }
    if (user.role === "superAdmin") {
      const activeSuperAdmins = await User.countDocuments({ role: "superAdmin", status: "active" });
      if (activeSuperAdmins <= 1) return res.status(400).json({ message: "The last active superAdmin cannot be deleted" });
    }
    await revokeUserSessions(id);
    await Promise.all([
      Admin.deleteOne({ user: id }),
      Staff.deleteOne({ user: id }),
      SuperAdmin.deleteOne({ user: id }),
      User.deleteOne({ _id: id }),
    ]);
    return res.status(200).json({ response_code: 200, success: true, message: "User deleted successfully" });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updateStaff = async (req, res) => {
  const { email, userName, supervisorId, ...incomingStaffFields } = req.body || {};
  const updates = Object.fromEntries(staffFields.filter((field) => incomingStaffFields[field] !== undefined).map((field) => [field, incomingStaffFields[field]]));
  if (email !== undefined && (typeof email !== "string" || !validator.isEmail(email.trim()))) {
    return res.status(400).json({ message: "Enter a valid email" });
  }
  if (supervisorId !== undefined) {
    if (req.user.role !== "superAdmin") return res.status(403).json({ message: "Only the superAdmin can change a staff supervisor" });
    const supervisor = await findActiveAdminSupervisor(supervisorId);
    if (!supervisor) return res.status(400).json({ message: "Select an active admin as the staff supervisor" });
    updates.adminId = supervisor._id;
  }
  try {
    const staff = await Staff.findOne({ _id: req.params.id, ...(await adminScope(req)) });
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    Object.assign(staff, updates);
    await staff.save();
    if (staff.user) {
      const userUpdates = {};
      if (typeof userName === "string" && userName.trim()) userUpdates.userName = userName.trim();
      if (typeof email === "string") userUpdates.email = email.trim().toLowerCase();
      if (updates.workStatus) userUpdates.status = updates.workStatus === "active" ? "active" : "inactive";
      if (Object.keys(userUpdates).length) await User.updateOne({ _id: staff.user }, { $set: userUpdates }, { runValidators: true });
      if (userUpdates.status === "inactive") await revokeUserSessions(staff.user);
    }
    return res.status(200).json({ response_code: 200, success: true, message: "Staff details updated successfully" });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updateAdmin = async (req, res) => {
  const { firstName, lastName, position, userName, email } = req.body || {};
  if (email !== undefined && (typeof email !== "string" || !validator.isEmail(email.trim()))) {
    return res.status(400).json({ message: "Enter a valid email" });
  }
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    if (firstName !== undefined) admin.firstName = firstName;
    if (lastName !== undefined) admin.lastName = lastName;
    if (position !== undefined) admin.position = position;
    await admin.save();
    const userUpdates = {};
    if (typeof userName === "string" && userName.trim()) userUpdates.userName = userName.trim();
    if (typeof email === "string") userUpdates.email = email.trim().toLowerCase();
    if (Object.keys(userUpdates).length) await User.updateOne({ _id: admin.user }, { $set: userUpdates }, { runValidators: true });
    return res.status(200).json({ response_code: 200, success: true, message: "Admin details updated successfully" });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};
