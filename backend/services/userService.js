import validator from "validator";
import User from "../models/userModel.js";
import Admin from "../models/adminModel.js";
import Staff from "../models/staffModel.js";
import SuperAdmin from "../models/superAdminModel.js";
import { adminScope, getAdminProfileId } from "./authorizationService.js";
import { ServiceError } from "./serviceError.js";
import { revokeUserSessions } from "./sessionService.js";
import { hashPassword } from "./credentialService.js";
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

export const userService = {
  async create(body = {}, actor) {
    const { email, password, userName, role, staffDetails = {}, adminDetails = {} } = body;
    if (typeof email !== "string" || typeof userName !== "string" || typeof password !== "string") {
      throw new ServiceError("Email, user name, and password are required", 400);
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = userName.trim();
    if (!validator.isEmail(normalizedEmail) || normalizedName.length < 1 || normalizedName.length > 120) {
      throw new ServiceError("Enter a valid email and user name", 400);
    }
    if (password.length < 10 || password.length > 128) {
      throw new ServiceError("Passwords must be between 10 and 128 characters", 400);
    }
    if (role === "superAdmin") {
      throw new ServiceError("The single superAdmin account is provisioned through the local bootstrap command", 403);
    }
    if (!["admin", "staff"].includes(role)) throw new ServiceError("Invalid account role", 400);
    if (role === "admin" && actor.role !== "superAdmin") {
      throw new ServiceError("Only a superAdmin can create admin accounts", 403);
    }
    if (await User.exists({ email: normalizedEmail })) throw new ServiceError("An account with this email already exists", 409);

    const ownAdminId = actor.role === "admin" ? await getAdminProfileId(actor) : null;
    if (actor.role === "admin" && !ownAdminId) {
      throw new ServiceError("An admin profile is required to create accounts", 403);
    }

    let staffAdminId = ownAdminId;
    if (role === "staff") {
      if (!staffDetails || typeof staffDetails !== "object" || Array.isArray(staffDetails)) {
        throw new ServiceError("Staff details are required", 400);
      }
      if (actor.role === "superAdmin") {
        const supervisor = await findActiveAdminSupervisor(staffDetails.supervisorId);
        if (!supervisor) throw new ServiceError("Select an active admin as the staff supervisor", 400);
        staffAdminId = supervisor._id;
      }
    }

    let createdUser;
    try {
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
      return createdUser;
    } catch (error) {
      if (createdUser) {
        await Promise.all([
          Admin.deleteOne({ user: createdUser._id }),
          Staff.deleteOne({ user: createdUser._id }),
          User.deleteOne({ _id: createdUser._id }),
        ]);
      }
      throw error;
    }
  },

  async getById(id) {
    const user = await User.findById(id)
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
    if (!user) throw new ServiceError("User not found", 404);
    const userDetails = user.toObject();
    const supervisor = userDetails.staffDetails?.adminId;
    if (supervisor && typeof supervisor === "object") {
      const supervisorName = [supervisor.firstName, supervisor.lastName].filter(Boolean).join(" ") || supervisor.user?.userName || "";
      userDetails.supervisor = { id: String(supervisor._id), name: supervisorName };
      userDetails.supervisorName = supervisorName;
    }
    return userDetails;
  },

  async updateSelf(actor, body = {}) {
    const { userName, email } = body;
    if (typeof userName !== "string" || typeof email !== "string") {
      throw new ServiceError("User name and email are required", 400);
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = userName.trim();
    if (!validator.isEmail(normalizedEmail) || !normalizedName || normalizedName.length > 120) {
      throw new ServiceError("Enter a valid email and user name", 400);
    }
    const updatedUser = await User.findOneAndUpdate(
      { _id: actor._id },
      { $set: { userName: normalizedName, email: normalizedEmail } },
      { new: true, runValidators: true }
    ).select(safeUserFields);
    if (!updatedUser) throw new ServiceError("User not found", 404);
    return updatedUser;
  },

  getAll() {
    return User.find().select(safeUserFields).populate("adminDetails staffDetails superAdminDetails");
  },

  async remove(id, actor) {
    if (!validId(id)) throw new ServiceError("Invalid user id", 400);
    if (String(actor._id) === String(id)) throw new ServiceError("You cannot delete your own account", 400);
    const user = await User.findById(id).select("_id role adminDetails");
    if (!user) throw new ServiceError("User not found", 404);
    if (user.role === "admin") {
      const adminProfile = user.adminDetails
        ? await Admin.findById(user.adminDetails).select("_id")
        : await Admin.findOne({ user: user._id }).select("_id");
      const supervisorIds = [adminProfile?._id, user._id].filter(Boolean);
      if (await Staff.exists({ adminId: { $in: supervisorIds } })) {
        throw new ServiceError("Reassign this admin's staff before deleting the admin account", 409);
      }
    }
    if (user.role === "superAdmin") {
      const activeSuperAdmins = await User.countDocuments({ role: "superAdmin", status: "active" });
      if (activeSuperAdmins <= 1) throw new ServiceError("The last active superAdmin cannot be deleted", 400);
    }
    await revokeUserSessions(id);
    await Promise.all([
      Admin.deleteOne({ user: id }),
      Staff.deleteOne({ user: id }),
      SuperAdmin.deleteOne({ user: id }),
      User.deleteOne({ _id: id }),
    ]);
    return user;
  },

  async updateStaff(id, body = {}, actor) {
    const { email, userName, supervisorId, ...incomingStaffFields } = body;
    const updates = Object.fromEntries(staffFields.filter((field) => incomingStaffFields[field] !== undefined).map((field) => [field, incomingStaffFields[field]]));
    if (email !== undefined && (typeof email !== "string" || !validator.isEmail(email.trim()))) {
      throw new ServiceError("Enter a valid email", 400);
    }
    if (supervisorId !== undefined) {
      if (actor.role !== "superAdmin") throw new ServiceError("Only the superAdmin can change a staff supervisor", 403);
      const supervisor = await findActiveAdminSupervisor(supervisorId);
      if (!supervisor) throw new ServiceError("Select an active admin as the staff supervisor", 400);
      updates.adminId = supervisor._id;
    }

    const staff = await Staff.findOne({ _id: id, ...(await adminScope({ user: actor })) });
    if (!staff) throw new ServiceError("Staff not found", 404);
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
    return staff;
  },

  async updateAdmin(id, body = {}) {
    const { firstName, lastName, position, userName, email } = body;
    if (email !== undefined && (typeof email !== "string" || !validator.isEmail(email.trim()))) {
      throw new ServiceError("Enter a valid email", 400);
    }
    const admin = await Admin.findById(id);
    if (!admin) throw new ServiceError("Admin not found", 404);
    if (firstName !== undefined) admin.firstName = firstName;
    if (lastName !== undefined) admin.lastName = lastName;
    if (position !== undefined) admin.position = position;
    await admin.save();
    const userUpdates = {};
    if (typeof userName === "string" && userName.trim()) userUpdates.userName = userName.trim();
    if (typeof email === "string") userUpdates.email = email.trim().toLowerCase();
    if (Object.keys(userUpdates).length) await User.updateOne({ _id: admin.user }, { $set: userUpdates }, { runValidators: true });
    return admin;
  },
};
