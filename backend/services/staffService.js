import Staff from "../models/staffModel.js";
import User from "../models/userModel.js";
import StaffPayroll from "../models/staffPayrollModel.js";
import { adminScope } from "./authorizationService.js";
import { ServiceError } from "./serviceError.js";
import { revokeUserSessions } from "./sessionService.js";

const editableFields = [
  "firstName", "lastName", "address", "phoneNumber", "position", "dateOfBirth", "dateOfHire",
  "empContactName", "empPhoneNumber", "bankAcNo", "bankName", "bankAcBranch", "notes", "payFrequency",
];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const parsePage = (value, fallback, max) => {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const populateStaffUser = (query) => query
  .populate("user", "_id userName email status")
  .populate({
    path: "adminId",
    select: "_id firstName lastName user",
    populate: { path: "user", select: "_id userName" },
  });
const includeUserFields = (staff) => staff.map((record) => {
  const row = record.toObject ? record.toObject() : { ...record };
  const supervisor = row.adminId && typeof row.adminId === "object" ? row.adminId : null;
  const supervisorName = [supervisor?.firstName, supervisor?.lastName].filter(Boolean).join(" ");
  row.supervisorId = supervisor?._id || row.adminId || null;
  row.supervisorName = supervisorName || supervisor?.user?.userName || "";
  row.email = row.user?.email || "";
  row.userName = row.user?.userName || "";
  row.status = row.user?.status || row.workStatus;
  return row;
});

export const staffService = {
  async update(id, body = {}, user) {
    const updates = Object.fromEntries(editableFields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
    const staff = await Staff.findOneAndUpdate(
      { _id: id, ...(await adminScope({ user })) },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!staff) throw new ServiceError("Staff not found", 404);
    return staff;
  },

  async remove(id, user) {
    const scope = await adminScope({ user });
    const existingStaff = await Staff.findOne({ _id: id, ...scope }).select("_id user");
    if (!existingStaff) throw new ServiceError("Staff not found", 404);
    if (await StaffPayroll.exists({ staff: existingStaff._id })) {
      throw new ServiceError("Staff with payroll receipts cannot be deleted. Mark the staff member inactive instead.", 409);
    }
    const staff = await Staff.findOneAndDelete({ _id: existingStaff._id, ...scope });
    if (!staff) throw new ServiceError("Staff not found", 404);
    if (staff.user) {
      await revokeUserSessions(staff.user);
      await User.deleteOne({ _id: staff.user, role: "staff" });
    }
    return staff;
  },

  async getById(id, user) {
    const staff = await populateStaffUser(Staff.findOne({ _id: id, ...(await adminScope({ user })) }));
    if (!staff) throw new ServiceError("Staff not found", 404);
    return includeUserFields([staff])[0];
  },

  async getAll(user) {
    const staffs = await populateStaffUser(Staff.find(await adminScope({ user })).sort({ createdAt: -1 }));
    return includeUserFields(staffs);
  },

  async count(user) {
    return Staff.countDocuments(await adminScope({ user }));
  },

  async getActive(user) {
    const staffs = await populateStaffUser(Staff.find({ ...(await adminScope({ user })), workStatus: "active" }).sort({ firstName: 1 }));
    return includeUserFields(staffs);
  },

  async getPaginated({ page: rawPage, limit: rawLimit, search: rawSearch = "" } = {}, user) {
    if (rawSearch !== "" && typeof rawSearch !== "string") throw new ServiceError("Invalid search", 400);
    const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
    const limit = parsePage(rawLimit, 10, 100);
    const search = rawSearch.trim().slice(0, 100);
    const searchFilter = search
      ? { $or: ["firstName", "lastName", "address"].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) }
      : {};
    const query = { ...(await adminScope({ user })), ...searchFilter };
    const [totalResult, staffs] = await Promise.all([
      Staff.countDocuments(query),
      populateStaffUser(Staff.find(query).skip((page - 1) * limit).sort({ createdAt: -1 }).limit(limit)),
    ]);
    return {
      staffs: includeUserFields(staffs),
      paginationInfo: { totalPages: Math.ceil(totalResult / limit), currentPage: page, totalResult, pageSize: limit },
    };
  },

  async updateStatus(id, workStatus, user) {
    if (!["active", "inactive"].includes(workStatus)) throw new ServiceError("Invalid work status", 400);
    const staff = await Staff.findOneAndUpdate(
      { _id: id, ...(await adminScope({ user })) },
      { $set: { workStatus } },
      { new: true, runValidators: true }
    );
    if (!staff) throw new ServiceError("Staff not found", 404);
    if (staff.user) {
      await User.updateOne({ _id: staff.user, role: "staff" }, { $set: { status: workStatus } });
      if (workStatus === "inactive") await revokeUserSessions(staff.user);
    }
    return staff;
  },
};
