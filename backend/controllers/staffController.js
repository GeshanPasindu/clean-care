import Staff from "../models/staffModel.js";
import User from "../models/userModel.js";
import RefreshSession from "../models/refreshSessionModel.js";
import RefreshToken from "../models/refreshTokenModel.js";
import { adminScope } from "../middleware/authorization.js";

const editableFields = [
  "firstName", "lastName", "address", "phoneNumber", "position", "dateOfBirth", "dateOfHire",
  "empContactName", "empPhoneNumber", "bankAcNo", "bankName", "bankAcBranch", "notes",
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

export const updateStaffById = async (req, res) => {
  const updates = Object.fromEntries(editableFields.filter((field) => req.body?.[field] !== undefined).map((field) => [field, req.body[field]]));
  try {
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, ...(await adminScope(req)) },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    return res.status(200).json({ response_code: 200, success: true, message: "Staff updated successfully", staff });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const deleteStaffById = async (req, res) => {
  try {
    const staff = await Staff.findOneAndDelete({ _id: req.params.id, ...(await adminScope(req)) });
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    if (staff.user) {
      await revokeUserSessions(staff.user);
      await User.deleteOne({ _id: staff.user, role: "staff" });
    }
    return res.status(200).json({ response_code: 200, success: true, message: "Staff deleted successfully" });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getStaffById = async (req, res) => {
  const staff = await populateStaffUser(Staff.findOne({ _id: req.params.id, ...(await adminScope(req)) }));
  if (!staff) return res.status(404).json({ message: "Staff not found" });
  return res.status(200).json({ response_code: 200, success: true, message: "Staff fetched successfully", staff: includeUserFields([staff])[0] });
};

export const getAllStaff = async (req, res) => {
  const staffs = await populateStaffUser(Staff.find(await adminScope(req)).sort({ createdAt: -1 }));
  return res.status(200).json({ response_code: 200, success: true, message: "Staff fetched successfully", staffs: includeUserFields(staffs) });
};

export const getAllStaffCount = async (req, res) => {
  const count = await Staff.countDocuments(await adminScope(req));
  return res.status(200).json({ response_code: 200, success: true, count });
};

export const getAllActiveStaff = async (req, res) => {
  const staffs = await populateStaffUser(Staff.find({ ...(await adminScope(req)), workStatus: "active" }).sort({ firstName: 1 }));
  return res.status(200).json({ response_code: 200, success: true, message: "Active staff fetched successfully", staffs: includeUserFields(staffs) });
};

export const getAllStaffsPagination = async (req, res) => {
  const { page: rawPage, limit: rawLimit, search: rawSearch = "" } = req.query;
  if (rawSearch !== "" && typeof rawSearch !== "string") return res.status(400).json({ message: "Invalid search" });
  const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePage(rawLimit, 10, 100);
  const search = rawSearch.trim().slice(0, 100);
  const searchFilter = search
    ? { $or: ["firstName", "lastName", "address"].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) }
    : {};
  const query = { ...(await adminScope(req)), ...searchFilter };
  try {
    const [totalResult, staffs] = await Promise.all([
      Staff.countDocuments(query),
      populateStaffUser(Staff.find(query).skip((page - 1) * limit).sort({ createdAt: -1 }).limit(limit)),
    ]);
    return res.status(200).json({
      response_code: 200,
      success: true,
      message: "Staff fetched successfully",
      staffs: includeUserFields(staffs),
      paginationInfo: { totalPages: Math.ceil(totalResult / limit), currentPage: page, totalResult, pageSize: limit },
    });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updateStatus = async (req, res) => {
  const { workStatus } = req.body || {};
  if (!["active", "inactive"].includes(workStatus)) return res.status(400).json({ message: "Invalid work status" });
  try {
    const staff = await Staff.findOneAndUpdate(
      { _id: req.params.id, ...(await adminScope(req)) },
      { $set: { workStatus } },
      { new: true, runValidators: true }
    );
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    if (staff.user) {
      await User.updateOne({ _id: staff.user, role: "staff" }, { $set: { status: workStatus } });
      if (workStatus === "inactive") await revokeUserSessions(staff.user);
    }
    return res.status(200).json({ response_code: 200, success: true, message: "Staff status updated successfully", staff });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};
