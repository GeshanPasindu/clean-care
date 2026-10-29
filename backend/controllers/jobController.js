import Job from "../models/jobModel.js";
import Staff from "../models/staffModel.js";
import Client from "../models/clientModel.js";
import mongoose from "mongoose";
import { adminScope, getAdminProfileId, getStaffProfileId, jobScope } from "../middleware/authorization.js";

const jobStatuses = ["InProgress", "Completed", "Cancelled"];
const paymentStatuses = ["Pending", "Done"];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const validId = (value) => mongoose.isValidObjectId(value);
const normalizeAssignedStaff = (value) => {
  const staffIds = Array.isArray(value) ? value : value ? [value] : [];
  if (!staffIds.length || staffIds.length > 50 || staffIds.some((id) => !validId(id))) return null;
  if (new Set(staffIds.map(String)).size !== staffIds.length) return null;
  return staffIds;
};
const asList = (value) => Array.isArray(value) ? value : value ? [value] : [];
const referenceId = (value) => String(value && typeof value === "object" ? value._id || value.staff || value : value || "");

function legacyStaffAssignments(job) {
  const staffMembers = asList(job.assignedStaff);
  if (!staffMembers.length) return [];
  const count = staffMembers.length;
  const estimatedHours = Number(job.estNoOfhours || 0) / count;
  const hourRate = Number(job.staffHourRate || 0);
  const estimatedPayment = Number(job.staffPayTotal ?? (Number(job.estNoOfhours || 0) * hourRate)) / count;
  const hours = Number(job.noOfhours || 0) / count;
  // `job.payment` is the customer invoice amount. Never copy it into staff payroll.
  const payment = Number((hours * hourRate).toFixed(2));
  return staffMembers.map((staff, index) => {
    const signInTime = index === 0 ? job.signInTime : null;
    const signOffTime = index === 0 ? job.signOffTime : null;
    return {
      staff,
      isAssigned: true,
      estimatedHours,
      hourRate,
      estimatedPayment,
      hours,
      payment,
      // Older paymentStatus is job-level and cannot safely be attributed to a person.
      paymentStatus: "Pending",
      signInTime,
      signOffTime,
      timeEntries: signInTime || signOffTime ? [{ signInTime, signOffTime, hours }] : [],
      isSignIn: index === 0 ? Boolean(job.isSignIn) : false,
      isSignOff: index === 0 ? Boolean(job.isSignOff) : false,
    };
  });
}

function assignmentRows(job) {
  const stored = asList(job.staffAssignments);
  return (stored.length ? stored : legacyStaffAssignments(job)).map((assignment) =>
    assignment?.toObject ? assignment.toObject() : { ...assignment }
  );
}

function createStaffAssignment(staffId, estimatedHours, hourRate) {
  const hours = Number(estimatedHours || 0);
  const rate = Number(hourRate || 0);
  return {
    staff: staffId,
    isAssigned: true,
    estimatedHours: hours,
    hourRate: rate,
    estimatedPayment: hours * rate,
    hours: 0,
    payment: 0,
    paymentStatus: "Pending",
    timeEntries: [],
    isSignIn: false,
    isSignOff: false,
  };
}

function normalizeStaffRates(value, staffIds, defaultRate) {
  const fallbackRate = Number(defaultRate || 0);
  if (!Number.isFinite(fallbackRate) || fallbackRate < 0) return null;
  if (value === undefined) return new Map(staffIds.map((staffId) => [String(staffId), fallbackRate]));
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const selectedIds = new Set(staffIds.map(String));
  const rates = new Map();
  for (const [staffId, rawRate] of Object.entries(value)) {
    const rate = Number(rawRate);
    if (!validId(staffId) || !selectedIds.has(staffId) || !Number.isFinite(rate) || rate < 0) return null;
    rates.set(staffId, rate);
  }
  for (const staffId of staffIds) {
    if (!rates.has(String(staffId))) rates.set(String(staffId), fallbackRate);
  }
  return rates;
}

function ensureStaffAssignments(job) {
  if (Array.isArray(job.staffAssignments) && job.staffAssignments.length) return job.staffAssignments;
  job.staffAssignments = legacyStaffAssignments(job).map((assignment) => ({
    ...assignment,
    staff: referenceId(assignment.staff),
  }));
  return job.staffAssignments;
}

function refreshJobTotals(job) {
  const assignments = ensureStaffAssignments(job);
  const currentAssignments = assignments.filter((assignment) => assignment.isAssigned !== false);
  job.staffPayTotal = currentAssignments.reduce((total, assignment) => total + Number(assignment.estimatedPayment || 0), 0);
  job.staffHoursTotal = assignments.reduce((total, assignment) => total + Number(assignment.hours || 0), 0);
  job.staffPaymentTotal = assignments.reduce((total, assignment) => total + Number(assignment.payment || 0), 0);
  job.paymentStatus = currentAssignments.length > 0 && currentAssignments.every((assignment) => assignment.paymentStatus === "Done")
    ? "Done"
    : "Pending";
}

function refreshAttendanceSummary(job) {
  const currentAssignments = ensureStaffAssignments(job).filter((assignment) => assignment.isAssigned !== false);
  job.isSignIn = currentAssignments.some((assignment) => assignment.isSignIn && !assignment.isSignOff);
  job.isSignOff = currentAssignments.length > 0 && currentAssignments.every((assignment) => assignment.isSignOff);
  const startTimes = currentAssignments.map((assignment) => assignment.signInTime).filter(Boolean).map((date) => new Date(date).getTime());
  const endTimes = currentAssignments.map((assignment) => assignment.signOffTime).filter(Boolean).map((date) => new Date(date).getTime());
  job.signInTime = startTimes.length ? new Date(Math.min(...startTimes)) : null;
  job.signOffTime = job.isSignOff && endTimes.length ? new Date(Math.max(...endTimes)) : null;
}

function reconcileStaffAssignments(job, staffIds, staffRates) {
  const assignments = ensureStaffAssignments(job);
  const selectedIds = new Set(staffIds.map(String));
  assignments.forEach((assignment) => {
    assignment.isAssigned = selectedIds.has(referenceId(assignment.staff));
  });
  for (const staffId of staffIds) {
    if (!assignments.some((assignment) => referenceId(assignment.staff) === String(staffId))) {
      job.staffAssignments.push(createStaffAssignment(staffId, job.estNoOfhours, job.staffHourRate));
    }
  }
  for (const assignment of job.staffAssignments.filter((item) => item.isAssigned !== false)) {
    assignment.estimatedHours = Number(job.estNoOfhours || 0);
    assignment.hourRate = staffRates
      ? staffRates.get(referenceId(assignment.staff)) ?? Number(job.staffHourRate || 0)
      : Number(assignment.hourRate ?? job.staffHourRate ?? 0);
    assignment.estimatedPayment = assignment.estimatedHours * assignment.hourRate;
    if (assignment.hours > 0) assignment.payment = Number((assignment.hours * assignment.hourRate).toFixed(2));
  }
  refreshJobTotals(job);
  refreshAttendanceSummary(job);
}
const parsePage = (value, fallback, max) => {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const parseDate = (value) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

function presentJob(job, req) {
  const record = job?.toObject ? job.toObject() : { ...job };
  const assignedStaff = asList(record.assignedStaff);
  record.assignedStaff = assignedStaff.map((staff) => {
    if (!staff || typeof staff !== "object" || !staff._id) return staff;
    return {
      _id: staff._id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      ...(req.user?.role === "staff" ? {} : { phoneNumber: staff.phoneNumber }),
    };
  });
  record.staffAssignments = assignmentRows(record);
  if (req.user?.role !== "staff") return record;
  for (const key of ["adminId", "orgNoOfhours", "orgHourRate", "orgTotal", "staffHourRate", "staffPayTotal", "staffHoursTotal", "staffPaymentTotal", "payment", "paymentStatus", "noOfhours", "hourRate"]) {
    delete record[key];
  }
  if (record.client && typeof record.client === "object") {
    record.client = {
      _id: record.client._id,
      firstName: record.client.firstName,
      lastName: record.client.lastName,
      address: record.client.address,
      phoneNumber: record.client.phoneNumber,
    };
  }
  const currentStaffId = referenceId(req.user.staffDetails);
  const currentAssignment = record.staffAssignments.find((assignment) => referenceId(assignment.staff) === currentStaffId);
  record.currentStaffAssignment = currentAssignment ? {
    signInTime: currentAssignment.signInTime,
    signOffTime: currentAssignment.signOffTime,
    isSignIn: currentAssignment.isSignIn,
    isSignOff: currentAssignment.isSignOff,
    hours: currentAssignment.hours,
    timeEntries: (currentAssignment.timeEntries || []).map((entry) => ({
      signInTime: entry.signInTime,
      signOffTime: entry.signOffTime,
      hours: entry.hours,
    })),
  } : null;
  delete record.staffAssignments;
  return record;
}

const presentJobs = (jobs, req) => jobs.map((job) => presentJob(job, req));
const populatedJobs = (query, req) => req.user.role === "staff"
  ? query.populate("assignedStaff", "firstName lastName")
    .populate("staffAssignments.staff", "firstName lastName")
    .populate("client", "firstName lastName address phoneNumber")
  : query.populate("assignedStaff", "firstName lastName phoneNumber")
    .populate("staffAssignments.staff", "firstName lastName")
    .populate("client");

const dateBounds = (startDate, endDate) => {
  if (!startDate && !endDate) return null;
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start > end) throw new Error("Valid startDate and endDate are required");
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { $gte: start, $lte: end };
};

function tenantIdsForWrite(req, adminId) {
  return [adminId, req.user._id];
}

export const addJob = async (req, res) => {
  const {
    jobName, description, client: clientId, assignedStaff, staffRates,
    orgNoOfhours, orgHourRate, estNoOfhours, staffHourRate, notes, jobDate,
  } = req.body || {};
  try {
    if (typeof jobName !== "string" || !jobName.trim() || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ message: "Job name and description are required" });
    }
    const assignedStaffIds = normalizeAssignedStaff(assignedStaff);
    if (!validId(clientId) || !assignedStaffIds) return res.status(400).json({ message: "A valid client and at least one assigned staff member are required" });
    const numericValues = [orgNoOfhours, orgHourRate, estNoOfhours, staffHourRate].filter((value) => value !== undefined && value !== null && value !== "");
    if (numericValues.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
      return res.status(400).json({ message: "Hour and rate values must be non-negative numbers" });
    }
    const staffRateMap = normalizeStaffRates(staffRates, assignedStaffIds, staffHourRate);
    if (!staffRateMap) return res.status(400).json({ message: "Enter a valid non-negative hourly rate for each assigned staff member" });

    const adminId = await getAdminProfileId(req.user);
    if (!adminId) return res.status(403).json({ message: "An admin profile is required to create jobs" });
    const ownerScope = { adminId: { $in: tenantIdsForWrite(req, adminId) } };
    const [client, staffMembers] = await Promise.all([
      Client.findOne({ _id: clientId, ...ownerScope }).select("_id"),
      Staff.find({ _id: { $in: assignedStaffIds }, ...ownerScope }).select("_id"),
    ]);
    if (!client) return res.status(404).json({ message: "Client not found in this account" });
    if (staffMembers.length !== assignedStaffIds.length) return res.status(404).json({ message: "One or more assigned staff members were not found in this account" });

    const orgTotal = Number(orgNoOfhours || 0) * Number(orgHourRate || 0);
    const staffAssignments = assignedStaffIds.map((staffId) => createStaffAssignment(staffId, estNoOfhours, staffRateMap.get(String(staffId))));
    const staffPayTotal = staffAssignments.reduce((total, assignment) => total + assignment.estimatedPayment, 0);
    const job = await Job.create({
      jobName: jobName.trim(), description: description.trim(), client: clientId, assignedStaff: assignedStaffIds,
      staffAssignments, orgNoOfhours, orgHourRate, orgTotal, estNoOfhours, staffHourRate, staffPayTotal, payment: 0,
      notes, adminId, jobDate,
    });
    return res.status(201).json({ response_code: 201, success: true, message: "Job added successfully", job });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updatedJob = async (req, res) => {
  const { id } = req.params;
  const { jobName, description, client: clientId, assignedStaff, staffRates, orgNoOfhours, orgHourRate, estNoOfhours, staffHourRate, notes } = req.body || {};
  try {
    const assignedStaffIds = assignedStaff === undefined ? undefined : normalizeAssignedStaff(assignedStaff);
    if (assignedStaff !== undefined && !assignedStaffIds) {
      return res.status(400).json({ message: "Select at least one valid staff member; duplicate assignments are not allowed" });
    }
    const scope = await jobScope(req);
    const job = await Job.findOne({ _id: id, ...scope });
    if (!job) return res.status(404).json({ message: "Job not found" });
    const currentStaffIds = assignedStaffIds || asList(job.assignedStaff).map(referenceId);
    const staffRateMap = staffRates !== undefined || staffHourRate !== undefined
      ? normalizeStaffRates(staffRates, currentStaffIds, staffHourRate ?? job.staffHourRate)
      : undefined;
    if ((staffRates !== undefined || staffHourRate !== undefined) && !staffRateMap) {
      return res.status(400).json({ message: "Enter a valid non-negative hourly rate for each assigned staff member" });
    }
    if (staffRateMap) {
      const paidRateChange = ensureStaffAssignments(job).some((assignment) =>
        assignment.paymentStatus === "Done"
        && staffRateMap.has(referenceId(assignment.staff))
        && Number(staffRateMap.get(referenceId(assignment.staff))) !== Number(assignment.hourRate || 0)
      );
      if (paidRateChange) return res.status(409).json({ message: "Hourly rates for paid staff records cannot be changed" });
    }

    if (clientId !== undefined || assignedStaff !== undefined) {
      const ownerIds = [job.adminId, req.user.adminDetails, req.user._id].filter(Boolean);
      const ownerScope = { adminId: { $in: ownerIds } };
      if (clientId !== undefined && (!validId(clientId) || !(await Client.exists({ _id: clientId, ...ownerScope })))) {
        return res.status(400).json({ message: "Client must belong to this account" });
      }
      if (assignedStaffIds !== undefined) {
        const staffMembers = await Staff.find({ _id: { $in: assignedStaffIds }, ...ownerScope }).select("_id");
        if (staffMembers.length !== assignedStaffIds.length) {
          return res.status(400).json({ message: "Every assigned staff member must belong to this account" });
        }
        const selectedIds = new Set(assignedStaffIds.map(String));
        const activeStaffSession = ensureStaffAssignments(job).some((assignment) =>
          assignment.isAssigned !== false
          && assignment.isSignIn
          && !assignment.isSignOff
          && !selectedIds.has(referenceId(assignment.staff))
        );
        if (activeStaffSession) return res.status(409).json({ message: "Sign out staff before removing them from this job" });
      }
    }
    const values = { jobName, description, client: clientId, assignedStaff: assignedStaffIds, orgNoOfhours, orgHourRate, estNoOfhours, staffHourRate, notes };
    for (const [key, value] of Object.entries(values)) if (value !== undefined) job[key] = value;
    job.orgTotal = Number(job.orgNoOfhours || 0) * Number(job.orgHourRate || 0);
    if (assignedStaffIds !== undefined || estNoOfhours !== undefined || staffHourRate !== undefined || staffRates !== undefined) {
      reconcileStaffAssignments(job, currentStaffIds, staffRateMap);
    }
    await job.save();
    return res.status(200).json({ response_code: 200, success: true, message: "Job updated successfully", updatedJob: job });
  } catch (error) {
    const status = error.name === "VersionError" ? 409 : 400;
    return res.status(status).json({ response_code: status, success: false, error: status === 409 ? "This job changed during the update. Refresh and try again." : error.message });
  }
};

export const deleteJobById = async (req, res) => {
  const deletedJob = await Job.findOneAndDelete({ _id: req.params.id, ...(await adminScope(req)) });
  if (!deletedJob) return res.status(404).json({ message: "Job not found" });
  return res.status(200).json({ response_code: 200, success: true, message: "Job deleted successfully" });
};

export const getJobById = async (req, res) => {
  const job = await populatedJobs(Job.findOne({ _id: req.params.id, ...(await jobScope(req)) }), req);
  if (!job) return res.status(404).json({ message: "Job not found" });
  const responseJob = presentJob(job, req);
  return res.status(200).json({ response_code: 200, success: true, message: "Job fetched successfully", job: responseJob });
};

export const getAllJobs = async (req, res) => {
  try {
    const { startDate, endDate, staffId, clientId } = req.query;
    const filter = { ...(await jobScope(req)) };
    const dates = dateBounds(startDate, endDate);
    if (dates) filter.jobDate = dates;
    if (req.user.role !== "staff" && staffId) {
      if (!validId(staffId)) return res.status(400).json({ message: "Invalid staff id" });
      filter.assignedStaff = staffId;
    }
    if (req.user.role !== "staff" && clientId) {
      if (!validId(clientId)) return res.status(400).json({ message: "Invalid client id" });
      filter.client = clientId;
    }
    const jobs = await populatedJobs(Job.find(filter).sort({ createdAt: -1 }), req);
    return res.status(200).json({ response_code: 200, success: true, message: "Jobs fetched successfully", jobs: presentJobs(jobs, req) });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getAllJobsCount = async (req, res) => {
  const count = await Job.countDocuments(await jobScope(req));
  return res.status(200).json({ response_code: 200, success: true, count });
};

export const getTotalAndProfit = async (req, res) => {
  try {
    const result = await Job.aggregate([
      { $match: await adminScope(req) },
      { $group: {
        _id: null,
        totalOrgTotal: { $sum: "$orgTotal" },
        totalStaffPayTotal: { $sum: "$staffPayTotal" },
        totalProfit: { $sum: { $subtract: ["$orgTotal", "$staffPayTotal"] } },
      } },
    ]);
    const data = result[0] || { totalOrgTotal: 0, totalStaffPayTotal: 0, totalProfit: 0 };
    return res.status(200).json({ response_code: 200, success: true, message: "Totals and profit fetched successfully", data });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getAllJobPagination = async (req, res) => {
  const { page: rawPage, limit: rawLimit, search: rawSearch = "" } = req.query;
  if (rawSearch !== "" && typeof rawSearch !== "string") return res.status(400).json({ message: "Invalid search" });
  const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePage(rawLimit, 10, 100);
  const search = rawSearch.trim().slice(0, 100);
  const searchFilter = search ? { $or: ["jobName", "description", "notes"].map((field) => ({ [field]: { $regex: escapeRegex(search), $options: "i" } })) } : {};
  const query = { ...(await jobScope(req)), ...searchFilter };
  try {
    const [totalResult, jobs] = await Promise.all([
      Job.countDocuments(query),
      populatedJobs(Job.find(query).skip((page - 1) * limit).sort({ createdAt: -1 }).limit(limit), req),
    ]);
    return res.status(200).json({
      response_code: 200,
      success: true,
      message: "Jobs fetched successfully",
      jobs: presentJobs(jobs, req),
      paginationInfo: { totalPages: Math.ceil(totalResult / limit), currentPage: page, totalResult, pageSize: limit },
    });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const updateStatus = async (req, res) => {
  const { jobStatus } = req.body || {};
  if (!jobStatuses.includes(jobStatus)) return res.status(400).json({ message: "Invalid job status" });
  const job = await Job.findOneAndUpdate(
    { _id: req.params.id, ...(await adminScope(req)) },
    { $set: { jobStatus } },
    { new: true, runValidators: true }
  );
  if (!job) return res.status(404).json({ message: "Job not found" });
  return res.status(200).json({ response_code: 200, success: true, message: "Job status updated successfully", job });
};

export const getAllCompletedJobs = async (req, res) => {
  const jobs = await populatedJobs(Job.find({ ...(await adminScope(req)), jobStatus: "Completed" }).sort({ jobDate: -1 }), req);
  return res.status(200).json({ response_code: 200, success: true, message: "Completed jobs fetched successfully", jobs: presentJobs(jobs, req) });
};

export const signInJob = async (req, res) => {
  const { staffId } = req.body || {};
  try {
    const job = await Job.findOne({ _id: req.params.jobId, ...(await jobScope(req)) });
    if (!job) return res.status(404).json({ message: "Job not found" });
    const targetStaffId = req.user.role === "staff" ? await getStaffProfileId(req.user) : staffId;
    if (!validId(targetStaffId)) return res.status(400).json({ message: "A valid assigned staff member is required" });
    const assignment = ensureStaffAssignments(job).find((item) =>
      referenceId(item.staff) === String(targetStaffId) && item.isAssigned !== false
    );
    if (!assignment) return res.status(403).json({ message: "Only currently assigned staff members can sign in" });
    if (assignment.isSignIn && !assignment.isSignOff) return res.status(409).json({ message: "This staff member is already signed in" });
    const signInTime = new Date();
    assignment.timeEntries.push({ signInTime, signOffTime: null, hours: 0 });
    assignment.signInTime = signInTime;
    assignment.signOffTime = null;
    assignment.isSignIn = true;
    assignment.isSignOff = false;
    assignment.paymentStatus = "Pending";
    refreshJobTotals(job);
    refreshAttendanceSummary(job);
    await job.save();
    return res.status(200).json({ response_code: 200, success: true, message: "Staff signed in successfully", job: presentJob(job, req), data: presentJob(job, req) });
  } catch (error) {
    const status = error.name === "VersionError" ? 409 : 400;
    return res.status(status).json({ response_code: status, success: false, message: status === 409 ? "This job changed during the update. Refresh and try again." : error.message });
  }
};

export const signOffJob = async (req, res) => {
  const { staffId } = req.body || {};
  try {
    const job = await Job.findOne({ _id: req.params.jobId, ...(await jobScope(req)) });
    if (!job) return res.status(404).json({ message: "Job not found" });
    const targetStaffId = req.user.role === "staff" ? await getStaffProfileId(req.user) : staffId;
    if (!validId(targetStaffId)) return res.status(400).json({ message: "A valid assigned staff member is required" });
    const assignment = ensureStaffAssignments(job).find((item) =>
      referenceId(item.staff) === String(targetStaffId) && item.isAssigned !== false
    );
    if (!assignment) return res.status(403).json({ message: "Only currently assigned staff members can sign out" });
    if (!assignment.isSignIn || assignment.isSignOff) return res.status(409).json({ message: "This staff member is not currently signed in" });
    const signOffTime = new Date();
    const activeTimeEntry = [...assignment.timeEntries].reverse().find((entry) => !entry.signOffTime);
    if (!activeTimeEntry) return res.status(409).json({ message: "No active sign-in record was found for this staff member" });
    assignment.signOffTime = signOffTime;
    assignment.isSignOff = true;
    activeTimeEntry.signOffTime = signOffTime;
    activeTimeEntry.hours = Math.max(0, Number(((signOffTime.getTime() - new Date(activeTimeEntry.signInTime).getTime()) / 3600000).toFixed(2)));
    assignment.hours = assignment.timeEntries.reduce((total, entry) => total + Number(entry.hours || 0), 0);
    assignment.payment = Number((assignment.hours * Number(assignment.hourRate || 0)).toFixed(2));
    assignment.paymentStatus = "Pending";
    refreshJobTotals(job);
    refreshAttendanceSummary(job);
    await job.save();
    return res.status(200).json({ response_code: 200, success: true, message: "Staff signed off successfully", job: presentJob(job, req), data: presentJob(job, req) });
  } catch (error) {
    const status = error.name === "VersionError" ? 409 : 400;
    return res.status(status).json({ response_code: status, success: false, message: status === 409 ? "This job changed during the update. Refresh and try again." : error.message });
  }
};

export const getInvoice = async (req, res) => {
  const job = await Job.findOne({ _id: req.params.jobId, ...(await adminScope(req)) })
    .populate("client", "firstName lastName")
    .populate("assignedStaff", "firstName lastName");
  if (!job) return res.status(404).json({ message: "Job not found" });
  if (job.jobStatus !== "Completed") return res.status(400).json({ message: "Job is not completed yet" });
  const invoice = {
    jobName: job.jobName,
    description: job.description,
    client: `${job.client?.firstName || ""} ${job.client?.lastName || ""}`.trim(),
    assignedStaff: (Array.isArray(job.assignedStaff) ? job.assignedStaff : [job.assignedStaff])
      .map((staff) => [staff?.firstName, staff?.lastName].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(", "),
    jobDate: job.jobDate,
    signInTime: job.signInTime,
    signOffTime: job.signOffTime,
    noOfhours: job.noOfhours,
    hourRate: job.hourRate,
    payment: job.payment,
    notes: job.notes,
  };
  return res.status(200).json({ response_code: 200, success: true, invoice });
};

export const getJobsByStaffId = async (req, res) => {
  try {
    let staff;
    if (req.user.role === "staff") {
      staff = await Staff.findOne({ user: req.user._id }).select("_id");
    } else {
      const id = req.params.staffId;
      if (!validId(id)) return res.status(400).json({ message: "Invalid staff id" });
      const scope = await adminScope(req);
      staff = await Staff.findOne({ user: id, ...scope }).select("_id") || await Staff.findOne({ _id: id, ...scope }).select("_id");
    }
    if (!staff) return res.status(404).json({ message: "Staff member not found" });
    const filter = { ...(await jobScope(req)), assignedStaff: staff._id };
    const dates = dateBounds(req.query.startDate, req.query.endDate);
    if (dates) filter.jobDate = dates;
    const jobs = await populatedJobs(Job.find(filter).sort({ jobDate: -1 }), req);
    return res.status(200).json({ response_code: 200, success: true, message: "Jobs fetched successfully", jobs: presentJobs(jobs, req) });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getFilteredJobs = async (req, res) => {
  const { clientId } = req.params;
  const { jobStatus, minPayment, maxPayment, month, year, startDate, endDate } = req.query;
  if (!validId(clientId)) return res.status(400).json({ message: "Invalid client id" });
  if (jobStatus && !jobStatuses.includes(jobStatus)) return res.status(400).json({ message: "Invalid job status" });
  try {
    const client = await Client.findOne({ _id: clientId, ...(await adminScope(req)) }).select("_id");
    if (!client) return res.status(404).json({ message: "Client not found" });
    const query = { ...(await adminScope(req)), client: client._id };
    if (jobStatus) query.jobStatus = jobStatus;
    const numericMin = minPayment === undefined ? undefined : Number(minPayment);
    const numericMax = maxPayment === undefined ? undefined : Number(maxPayment);
    if ((numericMin !== undefined && (!Number.isFinite(numericMin) || numericMin < 0)) || (numericMax !== undefined && (!Number.isFinite(numericMax) || numericMax < 0))) {
      return res.status(400).json({ message: "Invalid payment filter" });
    }
    if (numericMin !== undefined || numericMax !== undefined) {
      query.payment = {};
      if (numericMin !== undefined) query.payment.$gte = numericMin;
      if (numericMax !== undefined) query.payment.$lte = numericMax;
    }
    if (month !== undefined || year !== undefined) {
      const numericMonth = month === undefined ? undefined : Number(month);
      const numericYear = year === undefined ? undefined : Number(year);
      if ((numericMonth !== undefined && (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 12)) || (numericYear !== undefined && (!Number.isInteger(numericYear) || numericYear < 2000 || numericYear > 2200))) {
        return res.status(400).json({ message: "Invalid month or year" });
      }
      if (numericMonth !== undefined && numericYear !== undefined) {
        query.jobDate = { $gte: new Date(numericYear, numericMonth - 1, 1), $lt: new Date(numericYear, numericMonth, 1) };
      } else if (numericYear !== undefined) {
        query.jobDate = { $gte: new Date(numericYear, 0, 1), $lt: new Date(numericYear + 1, 0, 1) };
      }
    }
    const dates = dateBounds(startDate, endDate);
    if (dates) query.jobDate = dates;
    const jobs = await populatedJobs(Job.find(query).sort({ jobDate: -1 }), req);
    const totalPayment = jobs.reduce((sum, job) => sum + (job.payment || 0), 0);
    return res.status(200).json({ response_code: 200, success: true, total: jobs.length, totalPayment, jobs: presentJobs(jobs, req) });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const getStaffJobsbyId = async (req, res) => {
  const { assignedStaff } = req.params;
  const { jobStatus, startDate, endDate } = req.query;
  if (!validId(assignedStaff)) return res.status(400).json({ message: "Invalid staff id" });
  if (jobStatus && !jobStatuses.includes(jobStatus)) return res.status(400).json({ message: "Invalid job status" });
  try {
    const staff = await Staff.findOne({ _id: assignedStaff, ...(await adminScope(req)) }).select("_id");
    if (!staff) return res.status(404).json({ message: "Staff member not found" });
    const query = {
      ...(await adminScope(req)),
      $or: [
        { assignedStaff: staff._id },
        { staffAssignments: { $elemMatch: { staff: staff._id } } },
      ],
    };
    if (jobStatus) query.jobStatus = jobStatus;
    const dates = dateBounds(startDate, endDate);
    if (dates) query.jobDate = dates;
    const jobs = await populatedJobs(Job.find(query).sort({ jobDate: -1 }), req);
    const presentedJobs = jobs.map((job) => {
      const presented = presentJob(job, req);
      presented.staffAssignment = presented.staffAssignments.find((assignment) => referenceId(assignment.staff) === String(staff._id)) || null;
      return presented;
    });
    const totalPayment = presentedJobs.reduce((sum, job) => sum + Number(job.staffAssignment?.payment || 0), 0);
    return res.status(200).json({ response_code: 200, success: true, total: jobs.length, totalPayment, jobs: presentedJobs });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const paymentJob = async (req, res) => {
  const { jobId, staffId, paymentStatus } = req.body || {};
  if (!validId(jobId) || !paymentStatuses.includes(paymentStatus)) return res.status(400).json({ message: "Invalid payment update" });
  if (staffId !== undefined && !validId(staffId)) return res.status(400).json({ message: "Invalid staff id" });
  try {
    const job = await Job.findOne({ _id: jobId, ...(await adminScope(req)) });
    if (!job) return res.status(404).json({ message: "Job not found" });
    const allAssignments = ensureStaffAssignments(job);
    const activeAssignments = allAssignments.filter((assignment) => assignment.isAssigned !== false);
    const targetStaffId = staffId || (activeAssignments.length === 1 ? referenceId(activeAssignments[0].staff) : null);
    const assignment = allAssignments.find((item) => referenceId(item.staff) === String(targetStaffId));
    if (!assignment) return res.status(404).json({ message: "Assigned staff member not found for this job" });
    assignment.paymentStatus = paymentStatus;
    refreshJobTotals(job);
    await job.save();
    return res.status(200).json({ response_code: 200, success: true, message: "Payment status updated successfully", job });
  } catch (error) {
    if (error.name === "VersionError") return res.status(409).json({ message: "This job changed during the update. Refresh and try again." });
    throw error;
  }
};
