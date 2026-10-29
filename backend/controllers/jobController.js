import Job from "../models/jobModel.js";
import Staff from "../models/staffModel.js";
import Admin from "../models/adminModel.js";
import Client from "../models/clientModel.js";
import StaffPayroll from "../models/staffPayrollModel.js";
import mongoose from "mongoose";
import { adminScope, getAdminProfileId, getStaffProfileId, jobScope } from "../middleware/authorization.js";

const jobStatuses = ["InProgress", "Completed", "Cancelled"];
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const validId = (value) => mongoose.isValidObjectId(value);
const PAYROLL_TIMEZONE_OFFSET_MS = 330 * 60 * 1000; // Sri Lanka Standard Time (UTC+05:30).
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
      timeEntries: signInTime || signOffTime ? [{ signInTime, signOffTime, hours, hourRate }] : [],
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
    if (assignment.hours > 0) {
      const timeEntries = asList(assignment.timeEntries);
      const timeEntryPayment = timeEntries.reduce((total, entry) => (
        total + Math.round(Number(entry.hours || 0) * Number(entry.hourRate ?? assignment.hourRate) * 100) / 100
      ), 0);
      assignment.payment = Number((timeEntries.length ? timeEntryPayment : assignment.hours * assignment.hourRate).toFixed(2));
    }
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

const parsePayrollDay = (value, endOfDay = false) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return new Date(date.getTime() - PAYROLL_TIMEZONE_OFFSET_MS);
};

function defaultPayrollPeriod(payFrequency, now = new Date()) {
  const businessToday = new Date(now.getTime() + PAYROLL_TIMEZONE_OFFSET_MS);
  const today = new Date(Date.UTC(businessToday.getUTCFullYear(), businessToday.getUTCMonth(), businessToday.getUTCDate()));
  if (payFrequency === "Monthly") {
    const currentMonthStart = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1) - PAYROLL_TIMEZONE_OFFSET_MS;
    return {
      periodStart: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1) - PAYROLL_TIMEZONE_OFFSET_MS),
      periodEnd: new Date(currentMonthStart - 1),
    };
  }
  const daysSinceMonday = (today.getUTCDay() + 6) % 7;
  const currentWeekStart = today.getTime() - daysSinceMonday * 86400000 - PAYROLL_TIMEZONE_OFFSET_MS;
  const periodStart = new Date(currentWeekStart - 7 * 86400000);
  return {
    periodStart,
    periodEnd: new Date(currentWeekStart - 1),
  };
}

function formatPayrollDay(value) {
  return new Date(new Date(value).getTime() + PAYROLL_TIMEZONE_OFFSET_MS).toISOString().slice(0, 10);
}

function getAssignmentPayrollPaidCents(assignment) {
  const receiptCents = asList(assignment.payoutReceipts)
    .reduce((sum, receipt) => sum + Math.round(Number(receipt.amount || 0) * 100), 0);
  const batchCents = asList(assignment.timeEntries)
    .reduce((sum, entry) => sum + Math.round(Number(entry.payoutAmount || 0) * 100), 0);
  return receiptCents + batchCents;
}

function presentJob(job, req, staffProfileId = null) {
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
  record.staffAssignments = assignmentRows(record).map((assignment) => ({
    ...assignment,
    payoutBatchTotal: asList(assignment.timeEntries)
      .reduce((sum, entry) => sum + Number(entry.payoutAmount || 0), 0),
  }));
  if (req.user?.role !== "staff") return record;
  for (const key of ["adminId", "orgNoOfhours", "orgHourRate", "orgTotal", "staffHourRate", "staffPayTotal", "staffHoursTotal", "staffPaymentTotal", "payment", "paymentStatus", "noOfhours", "hourRate", "receivedPayments"]) {
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
  const currentStaffId = referenceId(staffProfileId || req.user.staffDetails);
  const currentAssignment = record.staffAssignments.find((assignment) => referenceId(assignment.staff) === currentStaffId);
  record.currentStaffAssignment = currentAssignment ? {
    signInTime: currentAssignment.signInTime,
    signOffTime: currentAssignment.signOffTime,
    isSignIn: currentAssignment.isSignIn,
    isSignOff: currentAssignment.isSignOff,
    hours: currentAssignment.hours,
    hourRate: currentAssignment.hourRate,
    payment: currentAssignment.payment,
    paymentStatus: currentAssignment.paymentStatus,
    payoutReceipts: currentAssignment.payoutReceipts || [],
    payoutBatchTotal: currentAssignment.payoutBatchTotal || 0,
    staff: currentAssignment.staff,
    timeEntries: (currentAssignment.timeEntries || []).map((entry) => ({
      signInTime: entry.signInTime,
      signOffTime: entry.signOffTime,
      hours: entry.hours,
      description: entry.description || "",
    })),
  } : null;
  delete record.staffAssignments;
  return record;
}

const presentJobs = (jobs, req, staffProfileId) => jobs.map((job) => presentJob(job, req, staffProfileId));
async function attachPayrollProjection(presentedJobs) {
  const jobIds = presentedJobs.map((job) => job?._id).filter(Boolean);
  if (!jobIds.length) return presentedJobs;
  const payouts = await StaffPayroll.find({ "entries.jobId": { $in: jobIds } }).select("staff entries").lean();
  const totals = new Map();
  for (const payout of payouts) {
    for (const entry of asList(payout.entries)) {
      const key = `${String(entry.jobId)}:${String(payout.staff)}`;
      totals.set(key, (totals.get(key) || 0) + Number(entry.amount || 0));
    }
  }
  for (const job of presentedJobs) {
    const assignments = [
      ...asList(job.staffAssignments),
      job.staffAssignment,
      job.currentStaffAssignment,
    ].filter(Boolean);
    for (const assignment of assignments) {
      const batchTotal = Number(totals.get(`${String(job._id)}:${referenceId(assignment.staff)}`) || 0);
      assignment.payoutBatchTotal = batchTotal;
      const receiptTotal = asList(assignment.payoutReceipts)
        .reduce((sum, receipt) => sum + Number(receipt.amount || 0), 0);
      const due = Number(assignment.payment || 0);
      const isUntrackedLegacyPaid = assignment.paymentStatus === "Done"
        && receiptTotal === 0
        && batchTotal === 0;
      if (!isUntrackedLegacyPaid && (due > 0 || receiptTotal > 0 || batchTotal > 0)) {
        assignment.paymentStatus = receiptTotal + batchTotal + 0.005 >= due ? "Done" : "Pending";
      }
    }
  }
  return presentedJobs;
}
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
    const hasClientPayments = job.receivedPayments?.length > 0;
    if (hasClientPayments && clientId !== undefined && String(clientId) !== referenceId(job.client)) {
      return res.status(409).json({ message: "The client cannot be changed after a client payment has been recorded" });
    }
    const currentStaffIds = assignedStaffIds || asList(job.assignedStaff).map(referenceId);
    const staffRateMap = staffRates !== undefined || staffHourRate !== undefined
      ? normalizeStaffRates(staffRates, currentStaffIds, staffHourRate ?? job.staffHourRate)
      : undefined;
    if ((staffRates !== undefined || staffHourRate !== undefined) && !staffRateMap) {
      return res.status(400).json({ message: "Enter a valid non-negative hourly rate for each assigned staff member" });
    }
    if (staffRateMap) {
      const paidRateChange = ensureStaffAssignments(job).some((assignment) =>
        (assignment.paymentStatus === "Done" || asList(assignment.payoutReceipts).length > 0 || asList(assignment.timeEntries).some((entry) => entry.payoutBatchId))
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
        const payoutHistoryRemoval = ensureStaffAssignments(job).some((assignment) =>
          asList(assignment.payoutReceipts).length > 0 && !selectedIds.has(referenceId(assignment.staff))
        );
        if (payoutHistoryRemoval) return res.status(409).json({ message: "Staff with payout receipts cannot be removed from this job" });
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
    const billingChanged = orgNoOfhours !== undefined || orgHourRate !== undefined;
    const updatedOrgTotal = billingChanged
      ? Number(job.orgNoOfhours || 0) * Number(job.orgHourRate || 0)
      : Number(job.orgTotal || job.payment || 0);
    const receivedTotal = asList(job.receivedPayments).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (hasClientPayments && updatedOrgTotal + 0.005 < receivedTotal) {
      return res.status(409).json({ message: "The job total cannot be reduced below the amount already received" });
    }
    job.orgTotal = updatedOrgTotal;
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
  const scope = await adminScope(req);
  const hasPayrollHistory = await StaffPayroll.exists({ "entries.jobId": req.params.id, ...scope });
  if (hasPayrollHistory) return res.status(409).json({ message: "Jobs with recorded staff payroll cannot be deleted" });
  const deletedJob = await Job.findOneAndDelete({
    _id: req.params.id,
    ...scope,
    $and: [
      {
        $or: [
          { receivedPayments: { $exists: false } },
          { receivedPayments: { $size: 0 } },
        ],
      },
      {
        $nor: [
          { staffAssignments: { $elemMatch: { payoutReceipts: { $exists: true, $ne: [] } } } },
          { staffAssignments: { $elemMatch: { timeEntries: { $elemMatch: { payoutBatchId: { $exists: true, $ne: null } } } } } },
        ],
      },
    ],
  });
  if (!deletedJob) {
    const exists = await Job.exists({ _id: req.params.id, ...scope });
    if (!exists) return res.status(404).json({ message: "Job not found" });
    return res.status(409).json({ message: "Jobs with recorded payment receipts or payroll history cannot be deleted" });
  }
  return res.status(200).json({ response_code: 200, success: true, message: "Job deleted successfully" });
};

export const getJobById = async (req, res) => {
  const job = await populatedJobs(Job.findOne({ _id: req.params.id, ...(await jobScope(req)) }), req);
  if (!job) return res.status(404).json({ message: "Job not found" });
  const responseJob = presentJob(job, req);
  await attachPayrollProjection([responseJob]);
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
    assignment.timeEntries.push({ signInTime, signOffTime: null, hours: 0, hourRate: Number(assignment.hourRate || 0) });
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
  const { staffId, description } = req.body || {};
  if (typeof description !== "string" || !description.trim() || description.trim().length > 1000) {
    return res.status(400).json({ message: "A work description of 1 to 1000 characters is required" });
  }
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
    activeTimeEntry.description = description.trim();
    activeTimeEntry.hours = Math.max(0, Number(((signOffTime.getTime() - new Date(activeTimeEntry.signInTime).getTime()) / 3600000).toFixed(2)));
    activeTimeEntry.hourRate = Number(activeTimeEntry.hourRate ?? assignment.hourRate ?? 0);
    assignment.hours = assignment.timeEntries.reduce((total, entry) => total + Number(entry.hours || 0), 0);
    const entryPayment = assignment.timeEntries.reduce((total, entry) => (
      total + Math.round(Number(entry.hours || 0) * Number(entry.hourRate ?? assignment.hourRate ?? 0) * 100) / 100
    ), 0);
    assignment.payment = Number(entryPayment.toFixed(2));
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

export const getTimesheets = async (req, res) => {
  const page = parsePage(req.query.page, 1, 100000);
  const limit = parsePage(req.query.limit, 25, 200);
  const startDate = req.query.startDate === undefined ? null : parseDate(req.query.startDate);
  const endDate = req.query.endDate === undefined ? null : parseDate(req.query.endDate);
  if ((req.query.startDate !== undefined && !startDate) || (req.query.endDate !== undefined && !endDate)) {
    return res.status(400).json({ message: "Invalid timesheet date filter" });
  }
  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(23, 59, 59, 999);
  if (startDate && endDate && startDate > endDate) return res.status(400).json({ message: "Start date must be before end date" });

  try {
    let staffScope = null;
    let allowedStaffIds = null;
    let supervisorOwnerIds = null;
    if (req.user.role === "staff") {
      staffScope = String(await getStaffProfileId(req.user) || "");
      if (!validId(staffScope)) return res.status(403).json({ message: "A staff profile is required" });
      allowedStaffIds = new Set([staffScope]);
    } else if (req.user.role === "admin") {
      const ownAdminId = String(await getAdminProfileId(req.user) || "");
      if (req.query.supervisorId !== undefined && String(req.query.supervisorId) !== ownAdminId) {
        return res.status(404).json({ message: "Supervisor not found in your access scope" });
      }
      const ownedStaff = await Staff.find(await adminScope(req)).select("_id firstName lastName").lean();
      allowedStaffIds = new Set(ownedStaff.map((staff) => String(staff._id)));
    } else if (req.query.supervisorId !== undefined) {
      if (!validId(req.query.supervisorId)) return res.status(404).json({ message: "Supervisor not found" });
      const supervisor = await Admin.findOne({
        $or: [{ _id: req.query.supervisorId }, { user: req.query.supervisorId }],
      }).select("_id user");
      if (!supervisor) return res.status(404).json({ message: "Supervisor not found" });
      supervisorOwnerIds = [supervisor._id, supervisor.user].filter(Boolean).map(String);
      const supervisedStaff = await Staff.find({ adminId: { $in: supervisorOwnerIds } }).select("_id").lean();
      allowedStaffIds = new Set(supervisedStaff.map((staff) => String(staff._id)));
    }
    if (req.user.role !== "staff" && req.query.staffId !== undefined) {
      if (!validId(req.query.staffId) || !(await Staff.exists({ _id: req.query.staffId }))) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      if (allowedStaffIds && !allowedStaffIds.has(String(req.query.staffId))) {
        return res.status(404).json({ message: "Staff member is not under the selected supervisor" });
      }
      staffScope = String(req.query.staffId);
    }

    const jobFilters = [];
    if (req.user.role === "admin") jobFilters.push(await adminScope(req));
    if (req.user.role === "superAdmin" && supervisorOwnerIds) {
      jobFilters.push({ adminId: { $in: supervisorOwnerIds } });
    }
    if (staffScope) {
      jobFilters.push({
        $or: [
          { assignedStaff: staffScope },
          { staffAssignments: { $elemMatch: { staff: staffScope } } },
        ],
      });
    }
    const jobQuery = jobFilters.length > 1 ? { $and: jobFilters } : jobFilters[0] || {};
    const jobs = await Job.find(jobQuery)
      .select("jobName jobDate assignedStaff staffAssignments signInTime signOffTime isSignIn isSignOff noOfhours estNoOfhours staffHourRate staffPayTotal payment paymentStatus")
      .populate("assignedStaff", "firstName lastName")
      .populate("staffAssignments.staff", "firstName lastName")
      .sort({ jobDate: -1, createdAt: -1 });

    const timesheets = [];
    for (const job of jobs) {
      for (const assignment of assignmentRows(job)) {
        const staffId = referenceId(assignment.staff);
        if (!staffId || (allowedStaffIds && !allowedStaffIds.has(staffId))) continue;
        if (staffScope && staffId !== staffScope) continue;
        const staff = assignment.staff && typeof assignment.staff === "object" ? assignment.staff : {};
        for (const [entryIndex, entry] of (assignment.timeEntries || []).entries()) {
          if (!entry.signInTime) continue;
          const signedInAt = new Date(entry.signInTime);
          if (startDate && signedInAt < startDate) continue;
          if (endDate && signedInAt > endDate) continue;
          timesheets.push({
            id: `${job._id}-${staffId}-${entryIndex}`,
            jobId: String(job._id),
            jobName: job.jobName,
            jobDate: job.jobDate,
            staffId,
            staffName: [staff.firstName, staff.lastName].filter(Boolean).join(" "),
            signInTime: entry.signInTime,
            signOffTime: entry.signOffTime || null,
            hours: Number(entry.hours || 0),
            description: entry.description || "",
          });
        }
      }
    }
    timesheets.sort((left, right) => new Date(right.signInTime) - new Date(left.signInTime));
    const total = timesheets.length;
    const totalHours = Number(timesheets.reduce((sum, timesheet) => sum + Number(timesheet.hours || 0), 0).toFixed(2));
    const startIndex = (page - 1) * limit;
    return res.status(200).json({
      success: true,
      timesheets: timesheets.slice(startIndex, startIndex + limit),
      totalHours,
      paginationInfo: { total, currentPage: page, pageSize: limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
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
    const presentedJobs = await attachPayrollProjection(presentJobs(jobs, req, staff._id));
    return res.status(200).json({ response_code: 200, success: true, message: "Jobs fetched successfully", jobs: presentedJobs });
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
    await attachPayrollProjection(presentedJobs);
    const totalPayment = presentedJobs.reduce((sum, job) => sum + Number(job.staffAssignment?.payment || 0), 0);
    return res.status(200).json({ response_code: 200, success: true, total: jobs.length, totalPayment, jobs: presentedJobs });
  } catch (error) {
    return res.status(400).json({ response_code: 400, success: false, error: error.message });
  }
};

export const recordClientPayment = async (req, res) => {
  const { amount, paymentDate, method, referenceNumber = "" } = req.body || {};
  const numericAmount = Number(amount);
  const parsedDate = typeof paymentDate === "string" ? new Date(paymentDate) : null;
  const validMethods = ["Cash", "Bank Transfer", "Card", "Cheque", "Other"];

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ message: "Payment amount must be greater than zero" });
  }
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return res.status(400).json({ message: "A valid payment date is required" });
  }
  if (!validMethods.includes(method)) return res.status(400).json({ message: "Select a valid payment method" });
  if (typeof referenceNumber !== "string" || referenceNumber.length > 120) {
    return res.status(400).json({ message: "Reference must be text with no more than 120 characters" });
  }

  try {
    const scope = await adminScope(req);
    const job = await Job.findOne({ _id: req.params.jobId, ...scope });
    if (!job) return res.status(404).json({ message: "Job not found" });
    const client = await Client.findOne({ _id: job.client, ...scope }).select("firstName lastName email address phoneNumber");
    if (!client) return res.status(404).json({ message: "Client not found for this job" });

    const dueCents = Math.round(Number(job.orgTotal || job.payment || 0) * 100);
    const receivedCents = asList(job.receivedPayments).reduce((sum, payment) => sum + Math.round(Number(payment.amount || 0) * 100), 0);
    const amountCents = Math.round(numericAmount * 100);
    const balanceCents = dueCents - receivedCents;
    if (dueCents <= 0) return res.status(400).json({ message: "This job does not have a billable total" });
    if (amountCents > balanceCents) {
      return res.status(400).json({ message: `Payment exceeds the outstanding balance of ${(Math.max(balanceCents, 0) / 100).toFixed(2)}` });
    }

    job.receivedPayments.push({
      amount: amountCents / 100,
      paymentDate: parsedDate,
      method,
      referenceNumber: referenceNumber.trim(),
      recordedBy: req.user._id,
      clientName: [client.firstName, client.lastName].filter(Boolean).join(" "),
      clientEmail: client.email || "",
      clientAddress: client.address || "",
      clientPhoneNumber: client.phoneNumber || "",
      jobName: job.jobName || "",
    });
    const receipt = job.receivedPayments[job.receivedPayments.length - 1];
    await job.save();
    return res.status(201).json({
      response_code: 201,
      success: true,
      message: "Client payment recorded successfully",
      receipt: receipt.toObject(),
      receivedTotal: (receivedCents + amountCents) / 100,
      balance: Math.max(balanceCents - amountCents, 0) / 100,
    });
  } catch (error) {
    if (error.name === "VersionError") return res.status(409).json({ message: "This job changed during the payment update. Refresh and try again." });
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    throw error;
  }
};

export const recordStaffPayout = async (req, res) => {
  const { amount, paymentDate, method, referenceNumber = "", legacyReceiptOnly = false } = req.body || {};
  const numericAmount = Number(amount);
  const parsedDate = typeof paymentDate === "string" ? new Date(paymentDate) : null;
  const validMethods = ["Cash", "Bank Transfer", "Card", "Cheque", "Other"];

  if (!validId(req.params.staffId)) return res.status(400).json({ message: "Invalid staff id" });
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ message: "Payment amount must be greater than zero" });
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) return res.status(400).json({ message: "A valid payment date is required" });
  if (!validMethods.includes(method)) return res.status(400).json({ message: "Select a valid payment method" });
  if (typeof referenceNumber !== "string" || referenceNumber.length > 120) {
    return res.status(400).json({ message: "Reference must be text with no more than 120 characters" });
  }
  if (typeof legacyReceiptOnly !== "boolean") return res.status(400).json({ message: "Invalid legacy receipt flag" });

  try {
    const scope = await adminScope(req);
    const job = await Job.findOne({ _id: req.params.jobId, ...scope });
    if (!job) return res.status(404).json({ message: "Job not found" });
    const staff = await Staff.findOne({ _id: req.params.staffId, ...scope })
      .select("firstName lastName phoneNumber user")
      .populate("user", "email");
    if (!staff) return res.status(404).json({ message: "Staff member not found" });

    const assignment = ensureStaffAssignments(job).find((item) => referenceId(item.staff) === String(staff._id));
    if (!assignment) return res.status(404).json({ message: "Staff member is not assigned to this job" });

    const dueCents = Math.round(Number(assignment.payment || 0) * 100);
    const existingReceipts = asList(assignment.payoutReceipts);
    const paidCents = getAssignmentPayrollPaidCents(assignment);
    const amountCents = Math.round(numericAmount * 100);
    const batchPaidCents = asList(assignment.timeEntries)
      .reduce((sum, entry) => sum + Math.round(Number(entry.payoutAmount || 0) * 100), 0);
    const isLegacyPaidWithoutReceipt = assignment.paymentStatus === "Done" && existingReceipts.length === 0 && batchPaidCents === 0;
    if (dueCents <= 0) return res.status(400).json({ message: "This staff assignment has no payable amount yet" });

    if (legacyReceiptOnly) {
      if (!isLegacyPaidWithoutReceipt) return res.status(409).json({ message: "This assignment is not an unrecorded legacy payout" });
      if (amountCents !== dueCents) return res.status(400).json({ message: "Historical receipt amount must match the amount already marked paid" });
    } else {
      if (isLegacyPaidWithoutReceipt) {
        return res.status(409).json({ message: "This payout was marked paid before receipt history was available. Use the historical receipt option." });
      }
      const balanceCents = dueCents - paidCents;
      if (amountCents > balanceCents) {
        return res.status(400).json({ message: `Payment exceeds the outstanding staff balance of ${(Math.max(balanceCents, 0) / 100).toFixed(2)}` });
      }
    }

    assignment.payoutReceipts = assignment.payoutReceipts || [];
    assignment.payoutReceipts.push({
      amount: amountCents / 100,
      paymentDate: parsedDate,
      method,
      referenceNumber: referenceNumber.trim(),
      recordedBy: req.user._id,
      payeeName: [staff.firstName, staff.lastName].filter(Boolean).join(" "),
      payeeEmail: staff.user?.email || "",
      payeePhoneNumber: staff.phoneNumber || "",
      jobName: job.jobName || "",
      jobDate: job.jobDate,
      hours: Number(assignment.hours || 0),
      hourRate: Number(assignment.hourRate || 0),
    });
    const receipt = assignment.payoutReceipts[assignment.payoutReceipts.length - 1];
    const newPaidCents = legacyReceiptOnly ? dueCents : paidCents + amountCents;
    assignment.paymentStatus = newPaidCents >= dueCents ? "Done" : "Pending";
    refreshJobTotals(job);
    await job.save();
    return res.status(201).json({
      response_code: 201,
      success: true,
      message: legacyReceiptOnly ? "Historical staff receipt created" : "Staff payment recorded successfully",
      receipt: receipt.toObject(),
      paymentStatus: assignment.paymentStatus,
      paidTotal: newPaidCents / 100,
      balance: Math.max(dueCents - newPaidCents, 0) / 100,
    });
  } catch (error) {
    if (error.name === "VersionError") return res.status(409).json({ message: "This job changed during the payment update. Refresh and try again." });
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    throw error;
  }
};

async function findPayrollStaff(req) {
  const query = req.user.role === "staff"
    ? { _id: await getStaffProfileId(req.user) }
    : { _id: req.params.staffId, ...(await adminScope(req)) };
  if (!query._id || !validId(query._id)) return null;
  return Staff.findOne(query).select("firstName lastName phoneNumber payFrequency adminId user").populate("user", "email");
}

function payrollPeriodFromRequest(req, staff) {
  const { startDate, endDate } = req.query || {};
  if (startDate === undefined && endDate === undefined) return defaultPayrollPeriod(staff.payFrequency);
  if (startDate === undefined || endDate === undefined) return null;
  const periodStart = parsePayrollDay(startDate);
  const periodEnd = parsePayrollDay(endDate, true);
  if (!periodStart || !periodEnd || periodStart > periodEnd || periodEnd - periodStart > 366 * 86400000) return null;
  return { periodStart, periodEnd };
}

async function buildStaffPayrollPreview(staff, periodStart, periodEnd, scope) {
  const query = Job.find({
    ...scope,
    $or: [
      { assignedStaff: staff._id },
      { staffAssignments: { $elemMatch: { staff: staff._id } } },
    ],
  }).select("jobName jobDate assignedStaff staffAssignments");
  const [jobs, priorPayouts] = await Promise.all([
    query,
    StaffPayroll.find({ staff: staff._id }).select("entries").lean(),
  ]);
  const paidTimeEntries = new Map();
  for (const payout of priorPayouts) {
    for (const entry of asList(payout.entries)) {
      paidTimeEntries.set(`${referenceId(entry.jobId)}:${entry.timeEntryIndex}`, entry);
    }
  }
  const entries = [];

  for (const job of jobs) {
    const assignment = assignmentRows(job).find((item) => referenceId(item.staff) === String(staff._id));
    if (!assignment) continue;

    const storedEntries = asList(assignment.timeEntries);
    const sourceEntries = storedEntries.length
      ? storedEntries
      : assignment.signInTime
        ? [{ signInTime: assignment.signInTime, signOffTime: assignment.signOffTime, hours: assignment.hours, hourRate: assignment.hourRate }]
        : [];
    const sortedEntries = sourceEntries.map((entry, index) => ({ entry, index }))
      .sort((left, right) => new Date(left.entry.signInTime || 0) - new Date(right.entry.signInTime || 0));
    const legacyPaidWithoutReceipt = assignment.paymentStatus === "Done"
      && asList(assignment.payoutReceipts).length === 0
      && !sortedEntries.some(({ entry }) => entry.payoutBatchId);
    if (legacyPaidWithoutReceipt) continue;

    const oldReceiptTotalCents = asList(assignment.payoutReceipts)
      .reduce((sum, receipt) => sum + Math.round(Number(receipt.amount || 0) * 100), 0);
    const receiptCreditAlreadyAssignedCents = sortedEntries
      .filter(({ index }) => paidTimeEntries.has(`${String(job._id)}:${index}`))
      .reduce((sum, { index }) => sum + Math.round(Number(paidTimeEntries.get(`${String(job._id)}:${index}`)?.receiptCreditApplied || 0) * 100), 0);
    let receiptCreditCents = Math.max(oldReceiptTotalCents - receiptCreditAlreadyAssignedCents, 0);
    for (const { entry, index } of sortedEntries) {
      if (!entry.signInTime || !entry.signOffTime || entry.payoutBatchId || paidTimeEntries.has(`${String(job._id)}:${index}`)) continue;
      const hours = Number(entry.hours || 0);
      const hourRate = Number(entry.hourRate ?? assignment.hourRate ?? 0);
      const grossCents = Math.round(hours * hourRate * 100);
      if (hours <= 0 || grossCents <= 0) continue;

      const paidFromOlderReceipts = Math.min(grossCents, receiptCreditCents);
      receiptCreditCents -= paidFromOlderReceipts;
      const amountCents = grossCents - paidFromOlderReceipts;
      const signedInAt = new Date(entry.signInTime);
      if (amountCents <= 0 || signedInAt < periodStart || signedInAt > periodEnd) continue;
      entries.push({
        jobId: job._id,
        timeEntryIndex: index,
        jobName: job.jobName || "Job",
        jobDate: job.jobDate,
        signInTime: entry.signInTime,
        signOffTime: entry.signOffTime,
        description: entry.description || "",
        hours,
        hourRate,
        amount: amountCents / 100,
        receiptCreditApplied: paidFromOlderReceipts / 100,
      });
    }
  }

  entries.sort((left, right) => new Date(left.signInTime) - new Date(right.signInTime));
  const totalHours = Number(entries.reduce((total, entry) => total + entry.hours, 0).toFixed(2));
  const totalAmount = Number(entries.reduce((total, entry) => total + entry.amount, 0).toFixed(2));
  return { entries, totalHours, totalAmount };
}

export const getStaffPayroll = async (req, res) => {
  if (req.user.role !== "staff" && !validId(req.params.staffId)) {
    return res.status(400).json({ message: "Invalid staff id" });
  }
  try {
    const staff = await findPayrollStaff(req);
    if (!staff) return res.status(404).json({ message: "Staff member not found" });
    const period = payrollPeriodFromRequest(req, staff);
    if (!period) return res.status(400).json({ message: "Enter a valid payroll start and end date within a 12 month range" });
    const scope = req.user.role === "staff" ? {} : await adminScope(req);
    const [preview, payouts] = await Promise.all([
      buildStaffPayrollPreview(staff, period.periodStart, period.periodEnd, scope),
      StaffPayroll.find({ staff: staff._id }).select("-adminId -recordedBy").sort({ paymentDate: -1, createdAt: -1 }).limit(100).lean(),
    ]);
    return res.status(200).json({
      success: true,
      staff: {
        _id: staff._id,
        name: [staff.firstName, staff.lastName].filter(Boolean).join(" ") || "Staff member",
        email: staff.user?.email || "",
        phoneNumber: staff.phoneNumber || "",
        payFrequency: staff.payFrequency || "Weekly",
      },
      period: {
        periodStart: formatPayrollDay(period.periodStart),
        periodEnd: formatPayrollDay(period.periodEnd),
      },
      entries: preview.entries.map(({ jobId, timeEntryIndex, receiptCreditApplied, ...entry }) => entry),
      totalHours: preview.totalHours,
      totalAmount: preview.totalAmount,
      payouts: payouts.map((payout) => ({
        ...payout,
        entries: asList(payout.entries).map(({ jobId, timeEntryIndex, receiptCreditApplied, ...entry }) => entry),
      })),
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

export const recordStaffPayroll = async (req, res) => {
  const { periodStart: startValue, periodEnd: endValue, paymentDate, method, referenceNumber = "" } = req.body || {};
  const periodStart = parsePayrollDay(startValue);
  const periodEnd = parsePayrollDay(endValue, true);
  const parsedPaymentDate = typeof paymentDate === "string" ? new Date(paymentDate) : null;
  const validMethods = ["Cash", "Bank Transfer", "Card", "Cheque", "Other"];
  if (!periodStart || !periodEnd || periodStart > periodEnd || periodEnd - periodStart > 366 * 86400000) {
    return res.status(400).json({ message: "Enter a valid payroll period within a 12 month range" });
  }
  if (!parsedPaymentDate || Number.isNaN(parsedPaymentDate.getTime())) return res.status(400).json({ message: "A valid payment date is required" });
  if (!validMethods.includes(method)) return res.status(400).json({ message: "Select a valid payment method" });
  if (typeof referenceNumber !== "string" || referenceNumber.length > 120) {
    return res.status(400).json({ message: "Reference must be text with no more than 120 characters" });
  }

  try {
    const staff = await findPayrollStaff(req);
    if (!staff) return res.status(404).json({ message: "Staff member not found" });
    const scope = await adminScope(req);
    const preview = await buildStaffPayrollPreview(staff, periodStart, periodEnd, scope);
    if (!preview.entries.length || preview.totalAmount <= 0) {
      return res.status(409).json({ message: "There is no unpaid completed work in this period" });
    }

    const payout = new StaffPayroll({
      staff: staff._id,
      adminId: staff.adminId,
      payeeName: [staff.firstName, staff.lastName].filter(Boolean).join(" ") || "Staff member",
      payeeEmail: staff.user?.email || "",
      payeePhoneNumber: staff.phoneNumber || "",
      payFrequency: staff.payFrequency || "Weekly",
      periodStart,
      periodEnd,
      paymentDate: parsedPaymentDate,
      method,
      referenceNumber: referenceNumber.trim(),
      amount: preview.totalAmount,
      entries: preview.entries,
      recordedBy: req.user._id,
    });
    payout.receiptNumber = `CC-PAY-${String(payout._id).slice(-8).toUpperCase()}`;
    await payout.save();

    // The payroll document is the authoritative receipt ledger. These job updates keep the
    // existing job screens' paid status in sync; a failed projection cannot lose the payout.
    let projectionSyncPending = false;
    const jobsById = new Map();
    for (const entry of preview.entries) {
      const key = String(entry.jobId);
      if (!jobsById.has(key)) jobsById.set(key, []);
      jobsById.get(key).push(entry);
    }
    for (const [jobId, entries] of jobsById) {
      try {
        const job = await Job.findOne({ _id: jobId, ...scope });
        if (!job) {
          projectionSyncPending = true;
          continue;
        }
        const assignment = ensureStaffAssignments(job).find((item) => referenceId(item.staff) === String(staff._id));
        if (!assignment) {
          projectionSyncPending = true;
          continue;
        }
        for (const entry of entries) {
          let timeEntry = assignment.timeEntries?.[entry.timeEntryIndex];
          if (!timeEntry && entry.timeEntryIndex === 0 && !assignment.timeEntries?.length && assignment.signInTime) {
            assignment.timeEntries.push({
              signInTime: assignment.signInTime,
              signOffTime: assignment.signOffTime,
              description: "",
              hours: Number(assignment.hours || 0),
              hourRate: Number(assignment.hourRate || 0),
            });
            timeEntry = assignment.timeEntries[0];
          }
          if (!timeEntry) {
            projectionSyncPending = true;
            continue;
          }
          timeEntry.payoutAmount = entry.amount;
          timeEntry.payoutReceiptCredit = entry.receiptCreditApplied || 0;
          timeEntry.payoutBatchId = payout._id;
        }
        const dueCents = Math.round(Number(assignment.payment || 0) * 100);
        assignment.paymentStatus = getAssignmentPayrollPaidCents(assignment) >= dueCents ? "Done" : "Pending";
        refreshJobTotals(job);
        await job.save();
      } catch {
        projectionSyncPending = true;
      }
    }
    return res.status(201).json({
      success: true,
      message: "Staff payroll recorded successfully",
      payout: payout.toObject(),
      projectionSyncPending,
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "One or more shifts in this period have already been paid. Refresh the payroll preview." });
    if (error.name === "VersionError" || error.code === 112) return res.status(409).json({ message: "Payroll data changed while this payout was being recorded. Refresh and try again." });
    if (error.statusCode) return res.status(error.statusCode).json({ message: error.message });
    if (error.name === "ValidationError") return res.status(400).json({ message: error.message });
    throw error;
  }
};
