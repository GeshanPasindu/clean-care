import type { FilterQuery, Query } from "mongoose";
import type { ActorContext, EntityId, PayFrequency, ServiceContext, ServiceResult, JobStatus } from "../types/domain.js";
import type { JobRecord, JobDocument, JobView, StaffAssignment, UserReference, UserRecord, TimeEntry, ClientPaymentReceipt, StaffPaymentReceipt, RoleRecord, PayrollLine, AssignmentView } from "../types/models.js";
import type { PayrollPeriod, PayrollPreview, PayrollPreviewLine, FinancialSummary, PaymentSummary, TimesheetRow } from "../types/jobs.js";
import type { CreateJobInput, UpdateJobInput, JobListQuery, ClientJobQuery, TimesheetQuery, PayrollQuery, PaymentInput, StaffPayoutInput, PayrollInput, SignInInput, SignOffInput, PaginationQuery } from "../types/requests.js";
import { asList, referenceId } from "../utils/references.js";
type Empty = Record<string, never>;
type JobQuery<T> = Query<T, JobDocument, Record<string, never>, JobRecord>;
import { errorMessage, errorName, errorCode, errorStatus } from "../utils/errors.js";
import Job from "../models/jobModel.js";
import Client from "../models/clientModel.js";
import StaffPayroll from "../models/staffPayrollModel.js";
import Role from "../models/roleModel.js";
import User from "../models/userModel.js";
import mongoose from "mongoose";
import { tenantDataScope, getTenantIdForUser, getStaffUserId, jobScope } from "./authorizationService.js";

const serviceResult = <T>(statusCode: number, body: T): ServiceResult<T> => ({ statusCode, body });

const jobStatuses = ["InProgress", "Completed", "Cancelled"];
const isStaffContext = (context: ActorContext) => context.user?.scope === "staff";
const isPlatformContext = (context: ActorContext) => context.user?.scope === "platform";
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const validId = (value: unknown) => mongoose.isValidObjectId(value);
const PAYROLL_TIMEZONE_OFFSET_MS = 330 * 60 * 1000; // Sri Lanka Standard Time (UTC+05:30).
const normalizeAssignedStaff = (value: string[] | undefined) => {
  const staffIds = Array.isArray(value) ? value : value ? [value] : [];
  if (!staffIds.length || staffIds.length > 50 || staffIds.some((id) => !validId(id))) return null;
  if (new Set(staffIds.map(String)).size !== staffIds.length) return null;
  return staffIds;
};

async function employeeRoleIds() {
  const roles = await Role.find({ scope: { $in: ["tenant", "staff"] } }).select("_id").lean();
  return roles.map((role) => role._id);
}

async function employeeAccountFilter(extra: FilterQuery<UserRecord> = {}, requireActive = false) {
  return {
    ...extra,
    role: { $in: await employeeRoleIds() },
    isDeleted: false,
    ...(requireActive ? { status: "active" } : {}),
  };
}

async function findEmployeeAccount(id: EntityId | undefined | null, extra: FilterQuery<UserRecord> = {}, requireActive = false) {
  if (!validId(id)) return null;
  return User.findOne({ _id: id, ...(await employeeAccountFilter(extra, requireActive)) });
}

async function employeeTenantScope(context: ActorContext) {
  if (isPlatformContext(context)) return {};
  const tenantId = await getTenantIdForUser(context.user);
  return tenantId ? { tenantId } : { _id: { $in: [] } };
}

async function assignableStaffFilter(context: ActorContext) {
  const roles = await Role.find({ scope: "staff", isActive: true }).select("_id").lean();
  return {
    ...(await employeeTenantScope(context)),
    role: { $in: roles.map((role) => role._id) },
    status: "active",
    isDeleted: false,
  };
}

function legacyStaffAssignments(job: JobRecord): StaffAssignment[] {
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
      payoutReceipts: [],
      signInTime,
      signOffTime,
      timeEntries: signInTime || signOffTime ? [{ signInTime, signOffTime, hours, hourRate, description: "", payoutAmount: 0, payoutReceiptCredit: 0, payoutBatchId: null }] : [],
      isSignIn: index === 0 ? Boolean(job.isSignIn) : false,
      isSignOff: index === 0 ? Boolean(job.isSignOff) : false,
    };
  });
}

function assignmentRows(job: JobRecord): StaffAssignment[] {
  const stored = asList(job.staffAssignments);
  return (stored.length ? stored : legacyStaffAssignments(job)).map((assignment) =>
    assignment instanceof mongoose.Document ? assignment.toObject<StaffAssignment>() : { ...assignment }
  );
}

function createStaffAssignment(staffId: EntityId, estimatedHours: number | undefined, hourRate: number | undefined): StaffAssignment {
  const hours = Number(estimatedHours || 0);
  const rate = Number(hourRate || 0);
  return {
    staff: new mongoose.Types.ObjectId(staffId),
    isAssigned: true,
    estimatedHours: hours,
    hourRate: rate,
    estimatedPayment: hours * rate,
    hours: 0,
    payment: 0,
    paymentStatus: "Pending",
    payoutReceipts: [],
    timeEntries: [],
    isSignIn: false,
    isSignOff: false,
  };
}

function normalizeStaffRates(value: Record<string, number> | undefined, staffIds: EntityId[], defaultRate: number | undefined) {
  const fallbackRate = Number(defaultRate || 0);
  if (!Number.isFinite(fallbackRate) || fallbackRate < 0) return null;
  if (value === undefined) return new Map(staffIds.map((staffId) => [String(staffId), fallbackRate]));
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const selectedIds = new Set(staffIds.map(String));
  const rates = new Map<string, number>();
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

function ensureStaffAssignments(job: JobRecord) {
  if (Array.isArray(job.staffAssignments) && job.staffAssignments.length) return job.staffAssignments;
  job.staffAssignments = legacyStaffAssignments(job).map((assignment) => ({
    ...assignment,
    staff: new mongoose.Types.ObjectId(referenceId(assignment.staff)),
  }));
  return job.staffAssignments;
}

function refreshJobTotals(job: JobRecord) {
  const assignments = ensureStaffAssignments(job);
  const currentAssignments = assignments.filter((assignment) => assignment.isAssigned !== false);
  job.staffPayTotal = currentAssignments.reduce((total, assignment) => total + Number(assignment.estimatedPayment || 0), 0);
  job.staffHoursTotal = assignments.reduce((total, assignment) => total + Number(assignment.hours || 0), 0);
  job.staffPaymentTotal = assignments.reduce((total, assignment) => total + Number(assignment.payment || 0), 0);
  job.paymentStatus = currentAssignments.length > 0 && currentAssignments.every((assignment) => assignment.paymentStatus === "Done")
    ? "Done"
    : "Pending";
}

function refreshAttendanceSummary(job: JobRecord) {
  const currentAssignments = ensureStaffAssignments(job).filter((assignment) => assignment.isAssigned !== false);
  job.isSignIn = currentAssignments.some((assignment) => assignment.isSignIn && !assignment.isSignOff);
  job.isSignOff = currentAssignments.length > 0 && currentAssignments.every((assignment) => assignment.isSignOff);
  const startTimes = currentAssignments.flatMap((assignment) => assignment.signInTime ? [assignment.signInTime.getTime()] : []);
  const endTimes = currentAssignments.flatMap((assignment) => assignment.signOffTime ? [assignment.signOffTime.getTime()] : []);
  job.signInTime = startTimes.length ? new Date(Math.min(...startTimes)) : null;
  job.signOffTime = job.isSignOff && endTimes.length ? new Date(Math.max(...endTimes)) : null;
}

function reconcileStaffAssignments(job: JobRecord, staffIds: EntityId[], staffRates: Map<string, number> | undefined) {
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
const parsePage = (value: number | undefined, fallback: number, max: number) => {
  const parsed = Number(value ?? fallback);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, max) : fallback;
};
const parseDate = (value: string | undefined) => {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parsePayrollDay = (value: string | undefined, endOfDay = false) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return new Date(date.getTime() - PAYROLL_TIMEZONE_OFFSET_MS);
};

function defaultPayrollPeriod(payFrequency: PayFrequency, now = new Date()): PayrollPeriod {
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

function formatPayrollDay(value: Date) {
  return new Date(new Date(value).getTime() + PAYROLL_TIMEZONE_OFFSET_MS).toISOString().slice(0, 10);
}

function getAssignmentPayrollPaidCents(assignment: StaffAssignment) {
  const receiptCents = asList(assignment.payoutReceipts)
    .reduce((sum, receipt) => sum + Math.round(Number(receipt.amount || 0) * 100), 0);
  const batchCents = asList(assignment.timeEntries)
    .reduce((sum, entry) => sum + Math.round(Number(entry.payoutAmount || 0) * 100), 0);
  return receiptCents + batchCents;
}

function presentJob(job: JobRecord | JobDocument, context: ActorContext, staffProfileId: EntityId | null = null): JobView {
  const record: JobView = job instanceof mongoose.Document ? job.toObject<JobRecord>() : { ...job };
  const presentAssignedStaff = (staff: UserReference, includePhoneNumber: boolean) => {
    if (!("firstName" in staff)) return staff;
    return {
      _id: staff._id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      ...(includePhoneNumber ? { phoneNumber: staff.phoneNumber } : {}),
    };
  };
  const assignedStaff = asList(record.assignedStaff);
  record.assignedStaff = assignedStaff.map((staff) => presentAssignedStaff(staff, !isStaffContext(context)));
  record.staffAssignments = assignmentRows(job).map((assignment) => ({
    ...assignment,
    staff: presentAssignedStaff(assignment.staff, !isStaffContext(context)),
    payoutBatchTotal: asList(assignment.timeEntries)
      .reduce((sum, entry) => sum + Number(entry.payoutAmount || 0), 0),
  }));
  if (!isStaffContext(context)) return record;
  for (const key of ["tenantId", "orgNoOfhours", "orgHourRate", "orgTotal", "staffHourRate", "staffPayTotal", "staffHoursTotal", "staffPaymentTotal", "payment", "paymentStatus", "noOfhours", "hourRate", "receivedPayments"] as const) {
    delete record[key];
  }
  if (record.client && "firstName" in record.client) {
    record.client = {
      _id: record.client._id,
      firstName: record.client.firstName,
      lastName: record.client.lastName,
      address: record.client.address,
      phoneNumber: record.client.phoneNumber,
    };
  }
  const currentStaffId = referenceId(staffProfileId || context.user._id);
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

const presentJobs = (jobs: JobRecord[], context: ActorContext, staffProfileId?: EntityId) => jobs.map((job) => presentJob(job, context, staffProfileId));
async function attachPayrollProjection(presentedJobs: JobView[]) {
  const jobIds = presentedJobs.map((job) => job?._id).filter(Boolean);
  if (!jobIds.length) return presentedJobs;
  const payouts = await StaffPayroll.find({ "entries.jobId": { $in: jobIds } }).select("staff entries").lean();
  const totals = new Map<string, number>();
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
    ].filter((assignment): assignment is StaffAssignment | AssignmentView => assignment !== null && assignment !== undefined);
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
const populateStaffNames = <T>(query: JobQuery<T>, includePhoneNumber: boolean) => query
  .populate("assignedStaff", `_id firstName lastName${includePhoneNumber ? " phoneNumber" : ""}`)
  .populate("staffAssignments.staff", "_id firstName lastName");

const populatedJobs = <T>(query: JobQuery<T>, context: ActorContext) => isStaffContext(context)
  ? populateStaffNames(query, false)
    .populate("client", "firstName lastName address phoneNumber")
  : populateStaffNames(query, true)
    .populate("client");

const dateBounds = (startDate: string | undefined, endDate: string | undefined) => {
  if (!startDate && !endDate) return null;
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start > end) throw new Error("Valid startDate and endDate are required");
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { $gte: start, $lte: end };
};

export const addJob = async (context: ServiceContext<CreateJobInput>) => {
  const {
    jobName, description, client: clientId, assignedStaff, staffRates,
    orgNoOfhours, orgHourRate, estNoOfhours, staffHourRate, notes, jobDate,
  } = context.body || {};
  try {
    if (typeof jobName !== "string" || !jobName.trim() || typeof description !== "string" || !description.trim()) {
      return serviceResult(400, { message: "Job name and description are required" });
    }
    const assignedStaffIds = normalizeAssignedStaff(assignedStaff);
    if (!validId(clientId) || !assignedStaffIds) return serviceResult(400, { message: "A valid client and at least one assigned staff member are required" });
    const numericValues = [orgNoOfhours, orgHourRate, estNoOfhours, staffHourRate];
    if (numericValues.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
      return serviceResult(400, { message: "Hour and rate values must be non-negative numbers" });
    }
    const staffRateMap = normalizeStaffRates(staffRates, assignedStaffIds, staffHourRate);
    if (!staffRateMap) return serviceResult(400, { message: "Enter a valid non-negative hourly rate for each assigned staff member" });

    const tenantId = await getTenantIdForUser(context.user);
    if (!tenantId) return serviceResult(403, { message: "A tenant account is required to create jobs" });
    const ownerScope = await tenantDataScope(context);
    const staffFilter = await assignableStaffFilter(context);
    const [client, staffMembers] = await Promise.all([
      Client.findOne({ _id: clientId, ...ownerScope }).select("_id tenantId"),
      User.find({ _id: { $in: assignedStaffIds }, ...staffFilter }).select("_id"),
    ]);
    if (!client) return serviceResult(404, { message: "Client not found in this account" });
    if (staffMembers.length !== assignedStaffIds.length) return serviceResult(400, { message: "Only active Staff accounts within your access scope can be assigned to a job" });

    const orgTotal = Number(orgNoOfhours || 0) * Number(orgHourRate || 0);
    const staffAssignments = assignedStaffIds.map((staffId) => createStaffAssignment(staffId, estNoOfhours, staffRateMap.get(String(staffId))));
    const staffPayTotal = staffAssignments.reduce((total, assignment) => total + assignment.estimatedPayment, 0);
    const job = await Job.create({
      jobName: jobName.trim(), description: description.trim(), client: clientId, assignedStaff: assignedStaffIds,
      staffAssignments, orgNoOfhours, orgHourRate, orgTotal, estNoOfhours, staffHourRate, staffPayTotal, payment: 0,
      notes, tenantId: client.tenantId, jobDate,
    });
    return serviceResult(201, { response_code: 201, success: true, message: "Job added successfully", job });
  } catch (error) {
    return serviceResult(400, { response_code: 400, success: false, error: errorMessage(error) });
  }
};

export const updatedJob = async (context: ServiceContext<UpdateJobInput, { id: string }>) => {
  const { id } = context.params;
  const { jobName, description, client: clientId, assignedStaff, staffRates, orgNoOfhours, orgHourRate, estNoOfhours, staffHourRate, notes } = context.body || {};
  try {
    const assignedStaffIds = assignedStaff === undefined ? undefined : normalizeAssignedStaff(assignedStaff);
    if (assignedStaff !== undefined && !assignedStaffIds) {
      return serviceResult(400, { message: "Select at least one valid staff member; duplicate assignments are not allowed" });
    }
    const scope = await jobScope(context);
    const job = await Job.findOne({ _id: id, ...scope });
    if (!job) return serviceResult(404, { message: "Job not found" });
    const hasClientPayments = job.receivedPayments?.length > 0;
    if (hasClientPayments && clientId !== undefined && String(clientId) !== referenceId(job.client)) {
      return serviceResult(409, { message: "The client cannot be changed after a client payment has been recorded" });
    }
    const currentStaffIds = assignedStaffIds || asList(job.assignedStaff).map(referenceId);
    const staffRateMap = staffRates !== undefined || staffHourRate !== undefined
      ? normalizeStaffRates(staffRates, currentStaffIds, staffHourRate ?? job.staffHourRate)
      : undefined;
    if ((staffRates !== undefined || staffHourRate !== undefined) && !staffRateMap) {
      return serviceResult(400, { message: "Enter a valid non-negative hourly rate for each assigned staff member" });
    }
    if (staffRateMap) {
      const paidRateChange = ensureStaffAssignments(job).some((assignment) =>
        (assignment.paymentStatus === "Done" || asList(assignment.payoutReceipts).length > 0 || asList(assignment.timeEntries).some((entry) => entry.payoutBatchId))
        && staffRateMap.has(referenceId(assignment.staff))
        && Number(staffRateMap.get(referenceId(assignment.staff))) !== Number(assignment.hourRate || 0)
      );
      if (paidRateChange) return serviceResult(409, { message: "Hourly rates for paid staff records cannot be changed" });
    }

    if (clientId !== undefined || assignedStaff !== undefined) {
      const ownerIds = [job.tenantId, context.user.tenantId, context.user._id].filter((owner): owner is EntityId => owner !== null);
      const ownerScope = isPlatformContext(context) ? {} : { tenantId: { $in: ownerIds } };
      if (clientId !== undefined && (!validId(clientId) || !(await Client.exists({ _id: clientId, ...ownerScope })))) {
        return serviceResult(400, { message: "Client must belong to this account" });
      }
      if (assignedStaffIds) {
        const staffMembers = await User.find({ _id: { $in: assignedStaffIds }, ...(await assignableStaffFilter(context)) }).select("_id");
        if (staffMembers.length !== assignedStaffIds.length) {
          return serviceResult(400, { message: "Only active Staff accounts within your access scope can be assigned to a job" });
        }
        const selectedIds = new Set(assignedStaffIds.map(String));
        const payoutHistoryRemoval = ensureStaffAssignments(job).some((assignment) =>
          asList(assignment.payoutReceipts).length > 0 && !selectedIds.has(referenceId(assignment.staff))
        );
        if (payoutHistoryRemoval) return serviceResult(409, { message: "Staff with payout receipts cannot be removed from this job" });
        const activeStaffSession = ensureStaffAssignments(job).some((assignment) =>
          assignment.isAssigned !== false
          && assignment.isSignIn
          && !assignment.isSignOff
          && !selectedIds.has(referenceId(assignment.staff))
        );
        if (activeStaffSession) return serviceResult(409, { message: "Sign out staff before removing them from this job" });
      }
    }
    const values = { jobName, description, client: clientId, assignedStaff: assignedStaffIds, orgNoOfhours, orgHourRate, estNoOfhours, staffHourRate, notes };
    job.set(Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)));
    const billingChanged = orgNoOfhours !== undefined || orgHourRate !== undefined;
    const updatedOrgTotal = billingChanged
      ? Number(job.orgNoOfhours || 0) * Number(job.orgHourRate || 0)
      : Number(job.orgTotal || job.payment || 0);
    const receivedTotal = asList(job.receivedPayments).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    if (hasClientPayments && updatedOrgTotal + 0.005 < receivedTotal) {
      return serviceResult(409, { message: "The job total cannot be reduced below the amount already received" });
    }
    job.orgTotal = updatedOrgTotal;
    if (assignedStaffIds !== undefined || estNoOfhours !== undefined || staffHourRate !== undefined || staffRates !== undefined) {
      reconcileStaffAssignments(job, currentStaffIds, staffRateMap || undefined);
    }
    await job.save();
    return serviceResult(200, { response_code: 200, success: true, message: "Job updated successfully", updatedJob: job });
  } catch (error) {
    const status = errorName(error) === "VersionError" ? 409 : 400;
    return serviceResult(status, { response_code: status, success: false, error: status === 409 ? "This job changed during the update. Refresh and try again." : errorMessage(error) });
  }
};

export const deleteJobById = async (context: ServiceContext<Empty, { id: string }>) => {
  const scope = await tenantDataScope(context);
  const hasPayrollHistory = await StaffPayroll.exists({ "entries.jobId": context.params.id, ...scope });
  if (hasPayrollHistory) return serviceResult(409, { message: "Jobs with recorded staff payroll cannot be deleted" });
  const deletedJob = await Job.findOneAndDelete({
    _id: context.params.id,
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
    const exists = await Job.exists({ _id: context.params.id, ...scope });
    if (!exists) return serviceResult(404, { message: "Job not found" });
    return serviceResult(409, { message: "Jobs with recorded payment receipts or payroll history cannot be deleted" });
  }
  return serviceResult(200, { response_code: 200, success: true, message: "Job deleted successfully" });
};

export const getJobById = async (context: ServiceContext<Empty, { id: string }>) => {
  const job = await populatedJobs(Job.findOne({ _id: context.params.id, ...(await jobScope(context)) }), context);
  if (!job) return serviceResult(404, { message: "Job not found" });
  const responseJob = presentJob(job, context);
  await attachPayrollProjection([responseJob]);
  return serviceResult(200, { response_code: 200, success: true, message: "Job fetched successfully", job: responseJob });
};

export const getAllJobs = async (context: ServiceContext<Empty, Empty, JobListQuery>) => {
  try {
    const { startDate, endDate, staffId, clientId } = context.query;
    const filter: FilterQuery<JobRecord> = { ...(await jobScope(context)) };
    const dates = dateBounds(startDate, endDate);
    if (dates) filter.jobDate = dates;
    if (!isStaffContext(context) && staffId) {
      if (!validId(staffId)) return serviceResult(400, { message: "Invalid staff id" });
      filter.assignedStaff = staffId;
    }
    if (!isStaffContext(context) && clientId) {
      if (!validId(clientId)) return serviceResult(400, { message: "Invalid client id" });
      filter.client = clientId;
    }
    const jobs = await populatedJobs(Job.find(filter).sort({ createdAt: -1 }), context);
    return serviceResult(200, { response_code: 200, success: true, message: "Jobs fetched successfully", jobs: presentJobs(jobs, context) });
  } catch (error) {
    return serviceResult(400, { response_code: 400, success: false, error: errorMessage(error) });
  }
};

export const getAllJobsCount = async (context: ActorContext) => {
  const count = await Job.countDocuments(await jobScope(context));
  return serviceResult(200, { response_code: 200, success: true, count });
};

export const getTotalAndProfit = async (context: ActorContext) => {
  try {
    const result = await Job.aggregate<FinancialSummary>([
      { $match: await jobScope(context) },
      { $group: {
        _id: null,
        totalOrgTotal: { $sum: "$orgTotal" },
        totalStaffPayTotal: { $sum: "$staffPayTotal" },
        totalProfit: { $sum: { $subtract: ["$orgTotal", "$staffPayTotal"] } },
      } },
    ]);
    const data = result[0] || { totalOrgTotal: 0, totalStaffPayTotal: 0, totalProfit: 0 };
    return serviceResult(200, { response_code: 200, success: true, message: "Totals and profit fetched successfully", data });
  } catch (error) {
    return serviceResult(400, { response_code: 400, success: false, error: errorMessage(error) });
  }
};

export const getAllJobPagination = async (context: ServiceContext<Empty, Empty, JobListQuery>) => {
  const { page: rawPage, limit: rawLimit, search: rawSearch = "", startDate, endDate, staffId, clientId, jobStatus } = context.query;
  if (rawSearch !== "" && typeof rawSearch !== "string") return serviceResult(400, { message: "Invalid search" });
  const page = parsePage(rawPage, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePage(rawLimit, 25, 100);
  const search = rawSearch.trim().slice(0, 100);
  try {
    const conditions: FilterQuery<JobRecord>[] = [await jobScope(context)];
    const dates = dateBounds(startDate, endDate);
    if (dates) conditions.push({ jobDate: dates });
    if (jobStatus) {
      if (!jobStatuses.includes(jobStatus)) return serviceResult(400, { message: "Invalid job status" });
      conditions.push({ jobStatus });
    }
    if (staffId) {
      if (!validId(staffId)) return serviceResult(400, { message: "Invalid staff id" });
      const employeeId = new mongoose.Types.ObjectId(staffId);
      conditions.push({ $or: [{ assignedStaff: employeeId }, { "staffAssignments.staff": employeeId }] });
    }
    if (clientId) {
      if (!validId(clientId)) return serviceResult(400, { message: "Invalid client id" });
      conditions.push({ client: new mongoose.Types.ObjectId(clientId) });
    }
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };
      conditions.push({ $or: ["jobName", "description", "notes"].map((field) => ({ [field]: regex })) });
    }
    const query = conditions.length > 1 ? { $and: conditions } : conditions[0];
    const [totalResult, jobs, summary] = await Promise.all([
      Job.countDocuments(query),
      populatedJobs(Job.find(query).skip((page - 1) * limit).sort({ createdAt: -1, _id: -1 }).limit(limit), context),
      context.user?.permissions?.includes("jobs.financials.read") ? Job.aggregate<FinancialSummary>([
        { $match: query },
        { $group: {
          _id: null,
          totalOrgTotal: { $sum: { $ifNull: ["$orgTotal", 0] } },
          totalStaffPayTotal: { $sum: { $ifNull: ["$staffPayTotal", 0] } },
          totalReceived: { $sum: { $reduce: {
            input: { $ifNull: ["$receivedPayments", []] }, initialValue: 0,
            in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] },
          } } },
        } },
      ]) : Promise.resolve([]),
    ]);
    return serviceResult(200, {
      response_code: 200,
      success: true,
      message: "Jobs fetched successfully",
      jobs: presentJobs(jobs, context),
      paginationInfo: { totalPages: Math.ceil(totalResult / limit), currentPage: page, totalResult, pageSize: limit },
      ...(context.user?.permissions?.includes("jobs.financials.read")
        ? { summary: summary[0] || { totalOrgTotal: 0, totalStaffPayTotal: 0, totalReceived: 0 } }
        : {}),
    });
  } catch (error) {
    return serviceResult(400, { response_code: 400, success: false, error: errorMessage(error) });
  }
};

export const updateStatus = async (context: ServiceContext<{ jobStatus: JobStatus }, { id: string }>) => {
  const { jobStatus } = context.body || {};
  if (!jobStatuses.includes(jobStatus)) return serviceResult(400, { message: "Invalid job status" });
  const job = await Job.findOneAndUpdate(
    { _id: context.params.id, ...(await jobScope(context)) },
    { $set: { jobStatus } },
    { new: true, runValidators: true }
  );
  if (!job) return serviceResult(404, { message: "Job not found" });
  return serviceResult(200, { response_code: 200, success: true, message: "Job status updated successfully", job });
};

export const getAllCompletedJobs = async (context: ServiceContext<Empty, Empty, PaginationQuery>) => {
  const page = parsePage(context.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePage(context.query.limit, 25, 100);
  const search = typeof context.query.search === "string" ? context.query.search.trim().slice(0, 100) : "";
  const conditions: FilterQuery<JobRecord>[] = [await jobScope(context), { jobStatus: "Completed" }];
  if (search) {
    const regex = { $regex: escapeRegex(search), $options: "i" };
    conditions.push({ $or: ["jobName", "description", "notes"].map((field) => ({ [field]: regex })) });
  }
  const query = { $and: conditions };
  const [totalResult, jobs] = await Promise.all([
    Job.countDocuments(query),
    populatedJobs(Job.find(query).sort({ jobDate: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), context),
  ]);
  return serviceResult(200, {
    response_code: 200, success: true, message: "Completed jobs fetched successfully",
    jobs: presentJobs(jobs, context),
    paginationInfo: { totalResult, totalPages: Math.ceil(totalResult / limit), currentPage: page, pageSize: limit },
  });
};

export const signInJob = async (context: ServiceContext<SignInInput, { jobId: string }>) => {
  const { staffId } = context.body || {};
  let targetStaffId: EntityId | null | undefined;
  let activeJobClaimed = false;
  let attendanceSaved = false;
  try {
    const job = await Job.findOne({ _id: context.params.jobId, ...(await jobScope(context)) });
    if (!job) return serviceResult(404, { message: "Job not found" });
    targetStaffId = isStaffContext(context) ? await getStaffUserId(context.user) : staffId;
    if (!validId(targetStaffId)) return serviceResult(400, { message: "A valid assigned staff member is required" });
    if (context.user.scope === "tenant" && !(await findEmployeeAccount(targetStaffId, await employeeTenantScope(context)))) {
      return serviceResult(403, { message: "You can only manage attendance for staff under your supervision" });
    }
    const assignment = ensureStaffAssignments(job).find((item) =>
      referenceId(item.staff) === String(targetStaffId) && item.isAssigned !== false
    );
    if (!assignment) return serviceResult(403, { message: "Only currently assigned staff members can sign in" });
    if (assignment.isSignIn && !assignment.isSignOff) return serviceResult(409, { message: "This staff member is already signed in" });

    const assignedJobs = await Job.find({
      $or: [
        { assignedStaff: targetStaffId },
        { "staffAssignments.staff": targetStaffId },
      ],
    });
    const hasActiveSession = assignedJobs.some((assignedJob) =>
      ensureStaffAssignments(assignedJob).some((item) =>
        referenceId(item.staff) === String(targetStaffId)
        && item.isAssigned !== false
        && item.isSignIn
        && !item.isSignOff
      )
    );
    if (hasActiveSession) {
      return serviceResult(409, { message: "You are already signed in to another task. Sign out before starting a new one." });
    }

    const claimedStaff = await User.findOneAndUpdate(
      { _id: targetStaffId, activeJob: null, ...(await employeeAccountFilter({}, true)) },
      { $set: { activeJob: job._id } },
      { new: true, projection: { _id: 1 } }
    );
    if (!claimedStaff) {
      return serviceResult(409, { message: "You are already signed in to another task. Sign out before starting a new one." });
    }
    activeJobClaimed = true;

    const signInTime = new Date();
    assignment.timeEntries.push({ signInTime, signOffTime: null, hours: 0, hourRate: Number(assignment.hourRate || 0), description: "", payoutAmount: 0, payoutReceiptCredit: 0, payoutBatchId: null });
    assignment.signInTime = signInTime;
    assignment.signOffTime = null;
    assignment.isSignIn = true;
    assignment.isSignOff = false;
    assignment.paymentStatus = "Pending";
    refreshJobTotals(job);
    refreshAttendanceSummary(job);
    await job.save();
    attendanceSaved = true;
    return serviceResult(200, { response_code: 200, success: true, message: "Staff signed in successfully", job: presentJob(job, context), data: presentJob(job, context) });
  } catch (error) {
    if (activeJobClaimed && !attendanceSaved) {
      await User.updateOne({ _id: targetStaffId, activeJob: context.params.jobId }, { $set: { activeJob: null } }).catch(() => {});
    }
    const status = errorName(error) === "VersionError" ? 409 : 400;
    return serviceResult(status, { response_code: status, success: false, message: status === 409 ? "This job changed during the update. Refresh and try again." : errorMessage(error) });
  }
};

export const signOffJob = async (context: ServiceContext<SignOffInput, { jobId: string }>) => {
  const { staffId, description } = context.body || {};
  if (typeof description !== "string" || !description.trim() || description.trim().length > 1000) {
    return serviceResult(400, { message: "A work description of 1 to 1000 characters is required" });
  }
  try {
    const job = await Job.findOne({ _id: context.params.jobId, ...(await jobScope(context)) });
    if (!job) return serviceResult(404, { message: "Job not found" });
    const targetStaffId = isStaffContext(context) ? await getStaffUserId(context.user) : staffId;
    if (!validId(targetStaffId)) return serviceResult(400, { message: "A valid assigned staff member is required" });
    if (context.user.scope === "tenant" && !(await findEmployeeAccount(targetStaffId, await employeeTenantScope(context)))) {
      return serviceResult(403, { message: "You can only manage attendance for staff under your supervision" });
    }
    const assignment = ensureStaffAssignments(job).find((item) =>
      referenceId(item.staff) === String(targetStaffId) && item.isAssigned !== false
    );
    if (!assignment) return serviceResult(403, { message: "Only currently assigned staff members can sign out" });
    if (!assignment.isSignIn || assignment.isSignOff) return serviceResult(409, { message: "This staff member is not currently signed in" });
    const signOffTime = new Date();
    const activeTimeEntry = [...assignment.timeEntries].reverse().find((entry) => !entry.signOffTime);
    if (!activeTimeEntry?.signInTime) return serviceResult(409, { message: "No active sign-in record was found for this staff member" });
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
    await User.updateOne({ _id: targetStaffId, activeJob: job._id }, { $set: { activeJob: null } });
    return serviceResult(200, { response_code: 200, success: true, message: "Staff signed off successfully", job: presentJob(job, context), data: presentJob(job, context) });
  } catch (error) {
    const status = errorName(error) === "VersionError" ? 409 : 400;
    return serviceResult(status, { response_code: status, success: false, message: status === 409 ? "This job changed during the update. Refresh and try again." : errorMessage(error) });
  }
};

export const getTimesheets = async (context: ServiceContext<Empty, Empty, TimesheetQuery>) => {
  const page = parsePage(context.query.page, 1, 100000);
  const limit = parsePage(context.query.limit, 25, 200);
  const startDate = context.query.startDate === undefined ? null : parseDate(context.query.startDate);
  const endDate = context.query.endDate === undefined ? null : parseDate(context.query.endDate);
  if ((context.query.startDate !== undefined && !startDate) || (context.query.endDate !== undefined && !endDate)) {
    return serviceResult(400, { message: "Invalid timesheet date filter" });
  }
  if (startDate) startDate.setHours(0, 0, 0, 0);
  if (endDate) endDate.setHours(23, 59, 59, 999);
  if (startDate && endDate && startDate > endDate) return serviceResult(400, { message: "Start date must be before end date" });

  try {
    let staffScope: string | null = null;
    let allowedStaffIds: Set<string> | null = null;
    let supervisorOwnerIds: string[] | null = null;
    if (isStaffContext(context)) {
      staffScope = String(await getStaffUserId(context.user) || "");
      if (!validId(staffScope)) return serviceResult(403, { message: "A staff profile is required" });
      allowedStaffIds = new Set([staffScope]);
    } else if (context.user.scope === "tenant") {
      const ownTenantId = String(await getTenantIdForUser(context.user) || "");
      if (context.query.supervisorId !== undefined && String(context.query.supervisorId) !== ownTenantId) {
        return serviceResult(404, { message: "Supervisor not found in your access scope" });
      }
      const tenantId = await getTenantIdForUser(context.user);
      const ownedStaff = await User.find(await employeeAccountFilter({ tenantId })).select("_id").lean();
      allowedStaffIds = new Set(ownedStaff.map((employee) => String(employee._id)));
    } else if (context.query.supervisorId !== undefined) {
      if (!validId(context.query.supervisorId)) return serviceResult(404, { message: "Supervisor not found" });
      const supervisor = await User.findOne({ _id: context.query.supervisorId, status: "active", isDeleted: false })
        .populate<{ role: RoleRecord }>("role", "scope")
        .select("_id role");
      if (supervisor?.role?.scope !== "tenant") return serviceResult(404, { message: "Supervisor not found" });
      supervisorOwnerIds = [String(supervisor._id)];
      const supervisedStaff = await User.find(await employeeAccountFilter({ tenantId: { $in: supervisorOwnerIds } })).select("_id").lean();
      allowedStaffIds = new Set(supervisedStaff.map((employee) => String(employee._id)));
    }
    if (!isStaffContext(context) && context.query.staffId !== undefined) {
      if (!validId(context.query.staffId) || !(await findEmployeeAccount(context.query.staffId, await employeeTenantScope(context)))) {
        return serviceResult(404, { message: "Staff member not found" });
      }
      if (allowedStaffIds && !allowedStaffIds.has(String(context.query.staffId))) {
        return serviceResult(404, { message: "Staff member is not under the selected supervisor" });
      }
      staffScope = String(context.query.staffId);
    }

    const jobFilters = [await jobScope(context)];
    if (isPlatformContext(context) && supervisorOwnerIds && allowedStaffIds) {
      const supervisedStaffIds = [...allowedStaffIds].map((id) => new mongoose.Types.ObjectId(id));
      jobFilters.push({ $or: [
        { assignedStaff: { $in: supervisedStaffIds } },
        { "staffAssignments.staff": { $in: supervisedStaffIds } },
      ] });
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
    const jobs = await populateStaffNames(Job.find(jobQuery)
      .select("jobName jobDate assignedStaff staffAssignments signInTime signOffTime isSignIn isSignOff noOfhours estNoOfhours staffHourRate staffPayTotal payment paymentStatus")
      .sort({ jobDate: -1, createdAt: -1 }), true)
      .populate("client", "firstName lastName");

    const timesheets: TimesheetRow[] = [];
    for (const job of jobs) {
      for (const assignment of assignmentRows(job)) {
        const staffId = referenceId(assignment.staff);
        if (!staffId || (allowedStaffIds && !allowedStaffIds.has(staffId))) continue;
        if (staffScope && staffId !== staffScope) continue;
        const staff = "firstName" in assignment.staff ? assignment.staff : null;
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
            staffName: [staff?.firstName, staff?.lastName].filter(Boolean).join(" "),
            signInTime: entry.signInTime,
            signOffTime: entry.signOffTime || null,
            hours: Number(entry.hours || 0),
            description: entry.description || "",
          });
        }
      }
    }
    timesheets.sort((left, right) => new Date(right.signInTime).getTime() - new Date(left.signInTime).getTime());
    const total = timesheets.length;
    const totalHours = Number(timesheets.reduce((sum, timesheet) => sum + Number(timesheet.hours || 0), 0).toFixed(2));
    const startIndex = (page - 1) * limit;
    return serviceResult(200, {
      success: true,
      timesheets: timesheets.slice(startIndex, startIndex + limit),
      totalHours,
      paginationInfo: { total, currentPage: page, pageSize: limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return serviceResult(400, { message: errorMessage(error) });
  }
};

export const getInvoice = async (context: ServiceContext<Empty, { jobId: string }>) => {
  const job = await populateStaffNames(Job.findOne({ _id: context.params.jobId, ...(await tenantDataScope(context)) }), true)
    .populate("client", "firstName lastName");
  if (!job) return serviceResult(404, { message: "Job not found" });
  if (job.jobStatus !== "Completed") return serviceResult(400, { message: "Job is not completed yet" });
  const invoice = {
    jobName: job.jobName,
    description: job.description,
    client: "firstName" in job.client ? `${job.client.firstName} ${job.client.lastName}`.trim() : "",
    assignedStaff: (Array.isArray(job.assignedStaff) ? job.assignedStaff : [job.assignedStaff])
      .map((staff) => "firstName" in staff ? [staff.firstName, staff.lastName].filter(Boolean).join(" ") : "")
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
  return serviceResult(200, { response_code: 200, success: true, invoice });
};

export const getJobsByStaffId = async (context: ServiceContext<Empty, { staffId: string }, JobListQuery>) => {
  try {
    let employee: mongoose.HydratedDocument<UserRecord> | null;
    if (isStaffContext(context)) {
      employee = await findEmployeeAccount(context.user._id);
    } else {
      const id = context.params.staffId;
      if (!validId(id)) return serviceResult(400, { message: "Invalid staff id" });
      employee = await findEmployeeAccount(id, await employeeTenantScope(context));
    }
    if (!employee) return serviceResult(404, { message: "User account not found" });
    const filter = { ...(await jobScope(context)), assignedStaff: employee._id };
    const dates = dateBounds(context.query.startDate, context.query.endDate);
    if (dates) filter.jobDate = dates;
    const jobs = await populatedJobs(Job.find(filter).sort({ jobDate: -1 }), context);
    const presentedJobs = await attachPayrollProjection(presentJobs(jobs, context, employee._id));
    return serviceResult(200, { response_code: 200, success: true, message: "Jobs fetched successfully", jobs: presentedJobs });
  } catch (error) {
    return serviceResult(400, { response_code: 400, success: false, error: errorMessage(error) });
  }
};

export const getFilteredJobs = async (context: ServiceContext<Empty, { clientId: string }, ClientJobQuery>) => {
  const { clientId } = context.params;
  const { jobStatus, minPayment, maxPayment, month, year, startDate, endDate, search: rawSearch = "" } = context.query;
  const page = parsePage(context.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePage(context.query.limit, 25, 100);
  if (!validId(clientId)) return serviceResult(400, { message: "Invalid client id" });
  if (jobStatus && !jobStatuses.includes(jobStatus)) return serviceResult(400, { message: "Invalid job status" });
  try {
    const client = await Client.findOne({ _id: clientId, ...(await tenantDataScope(context)) }).select("_id");
    if (!client) return serviceResult(404, { message: "Client not found" });
    const query: FilterQuery<JobRecord> = { $and: [await jobScope(context), { client: client._id }] };
    if (typeof rawSearch !== "string") return serviceResult(400, { message: "Invalid search" });
    const search = rawSearch.trim().slice(0, 100);
    if (search) {
      const regex = { $regex: escapeRegex(search), $options: "i" };
      query.$or = ["jobName", "description", "notes"].map((field) => ({ [field]: regex }));
    }
    if (jobStatus) query.jobStatus = jobStatus;
    const numericMin = minPayment === undefined ? undefined : Number(minPayment);
    const numericMax = maxPayment === undefined ? undefined : Number(maxPayment);
    if ((numericMin !== undefined && (!Number.isFinite(numericMin) || numericMin < 0)) || (numericMax !== undefined && (!Number.isFinite(numericMax) || numericMax < 0))) {
      return serviceResult(400, { message: "Invalid payment filter" });
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
        return serviceResult(400, { message: "Invalid month or year" });
      }
      if (numericMonth !== undefined && numericYear !== undefined) {
        query.jobDate = { $gte: new Date(numericYear, numericMonth - 1, 1), $lt: new Date(numericYear, numericMonth, 1) };
      } else if (numericYear !== undefined) {
        query.jobDate = { $gte: new Date(numericYear, 0, 1), $lt: new Date(numericYear + 1, 0, 1) };
      }
    }
    const dates = dateBounds(startDate, endDate);
    if (dates) query.jobDate = dates;
    const [total, totalPaymentResult, jobs] = await Promise.all([
      Job.countDocuments(query),
      Job.aggregate<PaymentSummary>([{ $match: query }, { $group: { _id: null, totalPayment: { $sum: { $ifNull: ["$payment", 0] } } } }]),
      populatedJobs(Job.find(query).sort({ jobDate: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), context),
    ]);
    return serviceResult(200, {
      response_code: 200, success: true, total, totalPayment: totalPaymentResult[0]?.totalPayment || 0,
      jobs: presentJobs(jobs, context),
      paginationInfo: { totalResult: total, totalPages: Math.ceil(total / limit), currentPage: page, pageSize: limit },
    });
  } catch (error) {
    return serviceResult(400, { response_code: 400, success: false, error: errorMessage(error) });
  }
};

export const getStaffJobsbyId = async (context: ServiceContext<Empty, { assignedStaff: string }, JobListQuery>) => {
  const { assignedStaff } = context.params;
  const { jobStatus, startDate, endDate } = context.query;
  if (!validId(assignedStaff)) return serviceResult(400, { message: "Invalid staff id" });
  if (isStaffContext(context) && String(assignedStaff) !== String(context.user._id)) {
    return serviceResult(403, { message: "You can only view your own payment history" });
  }
  if (jobStatus && !jobStatuses.includes(jobStatus)) return serviceResult(400, { message: "Invalid job status" });
  const page = parsePage(context.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = parsePage(context.query.limit, 25, 100);
  try {
    const employee = await findEmployeeAccount(assignedStaff, await employeeTenantScope(context));
    if (!employee) return serviceResult(404, { message: "User account not found" });
    const query: FilterQuery<JobRecord> = { $and: [
      await jobScope(context),
      { $or: [
        { assignedStaff: employee._id },
        { staffAssignments: { $elemMatch: { staff: employee._id } } },
      ] },
    ] };
    if (jobStatus) query.jobStatus = jobStatus;
    const dates = dateBounds(startDate, endDate);
    if (dates) query.jobDate = dates;
    const [total, jobs, paymentSummary] = await Promise.all([
      Job.countDocuments(query),
      populatedJobs(Job.find(query).sort({ jobDate: -1, _id: -1 }).skip((page - 1) * limit).limit(limit), context),
      Job.aggregate<PaymentSummary>([
        { $match: query },
        { $unwind: "$staffAssignments" },
        { $match: { "staffAssignments.staff": employee._id, "staffAssignments.isAssigned": { $ne: false } } },
        { $group: { _id: null, totalPayment: { $sum: { $ifNull: ["$staffAssignments.payment", 0] } } } },
      ]),
    ]);
    const presentedJobs = jobs.map((job) => {
      const presented = presentJob(job, context);
      presented.staffAssignment = isStaffContext(context)
        ? presented.currentStaffAssignment
        : presented.staffAssignments?.find((assignment) => referenceId(assignment.staff) === String(employee._id)) || null;
      return presented;
    });
    await attachPayrollProjection(presentedJobs);
    return serviceResult(200, {
      response_code: 200, success: true, total, totalPayment: paymentSummary[0]?.totalPayment || 0, jobs: presentedJobs,
      paginationInfo: { totalResult: total, totalPages: Math.ceil(total / limit), currentPage: page, pageSize: limit },
    });
  } catch (error) {
    return serviceResult(400, { response_code: 400, success: false, error: errorMessage(error) });
  }
};

export const recordClientPayment = async (context: ServiceContext<PaymentInput, { jobId: string }>) => {
  const { amount, paymentDate, method, referenceNumber = "" } = context.body || {};
  const numericAmount = Number(amount);
  const parsedDate = typeof paymentDate === "string" ? new Date(paymentDate) : null;
  const validMethods = ["Cash", "Bank Transfer", "Card", "Cheque", "Other"];

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return serviceResult(400, { message: "Payment amount must be greater than zero" });
  }
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return serviceResult(400, { message: "A valid payment date is required" });
  }
  if (!validMethods.includes(method)) return serviceResult(400, { message: "Select a valid payment method" });
  if (typeof referenceNumber !== "string" || referenceNumber.length > 120) {
    return serviceResult(400, { message: "Reference must be text with no more than 120 characters" });
  }

  try {
    const scope = await tenantDataScope(context);
    const job = await Job.findOne({ _id: context.params.jobId, ...scope });
    if (!job) return serviceResult(404, { message: "Job not found" });
    const client = await Client.findOne({ _id: job.client, ...scope }).select("firstName lastName email address phoneNumber");
    if (!client) return serviceResult(404, { message: "Client not found for this job" });

    const dueCents = Math.round(Number(job.orgTotal || job.payment || 0) * 100);
    const receivedCents = asList(job.receivedPayments).reduce((sum, payment) => sum + Math.round(Number(payment.amount || 0) * 100), 0);
    const amountCents = Math.round(numericAmount * 100);
    const balanceCents = dueCents - receivedCents;
    if (dueCents <= 0) return serviceResult(400, { message: "This job does not have a billable total" });
    if (amountCents > balanceCents) {
      return serviceResult(400, { message: `Payment exceeds the outstanding balance of ${(Math.max(balanceCents, 0) / 100).toFixed(2)}` });
    }

    job.receivedPayments.push({
      amount: amountCents / 100,
      paymentDate: parsedDate,
      method,
      referenceNumber: referenceNumber.trim(),
      recordedBy: new mongoose.Types.ObjectId(context.user._id),
      clientName: [client.firstName, client.lastName].filter(Boolean).join(" "),
      clientEmail: client.email || "",
      clientAddress: client.address || "",
      clientPhoneNumber: client.phoneNumber || "",
      jobName: job.jobName || "",
    });
    const receipt = job.receivedPayments[job.receivedPayments.length - 1];
    await job.save();
    return serviceResult(201, {
      response_code: 201,
      success: true,
      message: "Client payment recorded successfully",
      receipt: receipt instanceof mongoose.Document ? receipt.toObject<ClientPaymentReceipt>() : receipt,
      receivedTotal: (receivedCents + amountCents) / 100,
      balance: Math.max(balanceCents - amountCents, 0) / 100,
    });
  } catch (error) {
    if (errorName(error) === "VersionError") return serviceResult(409, { message: "This job changed during the payment update. Refresh and try again." });
    if (errorName(error) === "ValidationError") return serviceResult(400, { message: errorMessage(error) });
    throw error;
  }
};

export const recordStaffPayout = async (context: ServiceContext<StaffPayoutInput, { jobId: string; staffId: string }>) => {
  const { amount, paymentDate, method, referenceNumber = "", legacyReceiptOnly = false } = context.body || {};
  const numericAmount = Number(amount);
  const parsedDate = typeof paymentDate === "string" ? new Date(paymentDate) : null;
  const validMethods = ["Cash", "Bank Transfer", "Card", "Cheque", "Other"];

  if (!validId(context.params.staffId)) return serviceResult(400, { message: "Invalid staff id" });
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return serviceResult(400, { message: "Payment amount must be greater than zero" });
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) return serviceResult(400, { message: "A valid payment date is required" });
  if (!validMethods.includes(method)) return serviceResult(400, { message: "Select a valid payment method" });
  if (typeof referenceNumber !== "string" || referenceNumber.length > 120) {
    return serviceResult(400, { message: "Reference must be text with no more than 120 characters" });
  }
  if (typeof legacyReceiptOnly !== "boolean") return serviceResult(400, { message: "Invalid legacy receipt flag" });

  try {
    const scope = await tenantDataScope(context);
    const job = await Job.findOne({ _id: context.params.jobId, ...scope });
    if (!job) return serviceResult(404, { message: "Job not found" });
    const staff = await findEmployeeAccount(context.params.staffId, await employeeTenantScope(context));
    if (!staff) return serviceResult(404, { message: "User account not found" });

    const assignment = ensureStaffAssignments(job).find((item) => referenceId(item.staff) === String(staff._id));
    if (!assignment) return serviceResult(404, { message: "Staff member is not assigned to this job" });

    const dueCents = Math.round(Number(assignment.payment || 0) * 100);
    const existingReceipts = asList(assignment.payoutReceipts);
    const paidCents = getAssignmentPayrollPaidCents(assignment);
    const amountCents = Math.round(numericAmount * 100);
    const batchPaidCents = asList(assignment.timeEntries)
      .reduce((sum, entry) => sum + Math.round(Number(entry.payoutAmount || 0) * 100), 0);
    const isLegacyPaidWithoutReceipt = assignment.paymentStatus === "Done" && existingReceipts.length === 0 && batchPaidCents === 0;
    if (dueCents <= 0) return serviceResult(400, { message: "This staff assignment has no payable amount yet" });

    if (legacyReceiptOnly) {
      if (!isLegacyPaidWithoutReceipt) return serviceResult(409, { message: "This assignment is not an unrecorded legacy payout" });
      if (amountCents !== dueCents) return serviceResult(400, { message: "Historical receipt amount must match the amount already marked paid" });
    } else {
      if (isLegacyPaidWithoutReceipt) {
        return serviceResult(409, { message: "This payout was marked paid before receipt history was available. Use the historical receipt option." });
      }
      const balanceCents = dueCents - paidCents;
      if (amountCents > balanceCents) {
        return serviceResult(400, { message: `Payment exceeds the outstanding staff balance of ${(Math.max(balanceCents, 0) / 100).toFixed(2)}` });
      }
    }

    assignment.payoutReceipts = assignment.payoutReceipts || [];
    assignment.payoutReceipts.push({
      amount: amountCents / 100,
      paymentDate: parsedDate,
      method,
      referenceNumber: referenceNumber.trim(),
      recordedBy: new mongoose.Types.ObjectId(context.user._id),
      payeeName: [staff.firstName, staff.lastName].filter(Boolean).join(" "),
      payeeEmail: staff.email || "",
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
    return serviceResult(201, {
      response_code: 201,
      success: true,
      message: legacyReceiptOnly ? "Historical staff receipt created" : "Staff payment recorded successfully",
      receipt: receipt instanceof mongoose.Document ? receipt.toObject<StaffPaymentReceipt>() : receipt,
      paymentStatus: assignment.paymentStatus,
      paidTotal: newPaidCents / 100,
      balance: Math.max(dueCents - newPaidCents, 0) / 100,
    });
  } catch (error) {
    if (errorName(error) === "VersionError") return serviceResult(409, { message: "This job changed during the payment update. Refresh and try again." });
    if (errorName(error) === "ValidationError") return serviceResult(400, { message: errorMessage(error) });
    throw error;
  }
};

async function findPayrollStaff(context: ActorContext & { params: { staffId: string } }) {
  const staffId = isStaffContext(context) ? await getStaffUserId(context.user) : context.params.staffId;
  return findEmployeeAccount(staffId, isStaffContext(context) ? {} : await employeeTenantScope(context));
}

function payrollPeriodFromRequest(context: { query: Pick<PayrollQuery, "startDate" | "endDate"> }, staff: UserRecord): PayrollPeriod | null {
  const { startDate, endDate } = context.query || {};
  if (startDate === undefined && endDate === undefined) return defaultPayrollPeriod(staff.payFrequency);
  if (startDate === undefined || endDate === undefined) return null;
  const periodStart = parsePayrollDay(startDate);
  const periodEnd = parsePayrollDay(endDate, true);
  if (!periodStart || !periodEnd || periodStart > periodEnd || periodEnd.getTime() - periodStart.getTime() > 366 * 86400000) return null;
  return { periodStart, periodEnd };
}

async function buildStaffPayrollPreview(staff: UserRecord, periodStart: Date, periodEnd: Date, scope: FilterQuery<JobRecord>): Promise<PayrollPreview> {
  const query = Job.find({ $and: [scope, { $or: [
      { assignedStaff: staff._id },
      { staffAssignments: { $elemMatch: { staff: staff._id } } },
    ] }] }).select("jobName jobDate assignedStaff staffAssignments");
  const [jobs, priorPayouts] = await Promise.all([
    query,
    StaffPayroll.find({ staff: staff._id }).select("entries").lean(),
  ]);
  const paidTimeEntries = new Map<string, PayrollLine>();
  for (const payout of priorPayouts) {
    for (const entry of asList(payout.entries)) {
      paidTimeEntries.set(`${referenceId(entry.jobId)}:${entry.timeEntryIndex}`, entry);
    }
  }
  const entries: PayrollPreviewLine[] = [];

  for (const job of jobs) {
    const assignment = assignmentRows(job).find((item) => referenceId(item.staff) === String(staff._id));
    if (!assignment) continue;

    const storedEntries = asList(assignment.timeEntries);
    const sourceEntries: TimeEntry[] = storedEntries.length
      ? storedEntries
      : assignment.signInTime
        ? [{ signInTime: assignment.signInTime, signOffTime: assignment.signOffTime, hours: assignment.hours, hourRate: assignment.hourRate, description: "", payoutAmount: 0, payoutReceiptCredit: 0, payoutBatchId: null }]
        : [];
    const sortedEntries = sourceEntries.map((entry, index) => ({ entry, index }))
      .sort((left, right) => new Date(left.entry.signInTime || 0).getTime() - new Date(right.entry.signInTime || 0).getTime());
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

  entries.sort((left, right) => left.signInTime.getTime() - right.signInTime.getTime());
  const totalHours = Number(entries.reduce((total, entry) => total + entry.hours, 0).toFixed(2));
  const totalAmount = Number(entries.reduce((total, entry) => total + entry.amount, 0).toFixed(2));
  return { entries, totalHours, totalAmount };
}

export const getStaffPayroll = async (context: ServiceContext<Empty, { staffId: string }, PayrollQuery>) => {
  if (!isStaffContext(context) && !validId(context.params.staffId)) {
    return serviceResult(400, { message: "Invalid staff id" });
  }
  try {
    const staff = await findPayrollStaff(context);
    if (!staff) return serviceResult(404, { message: "Staff member not found" });
    const period = payrollPeriodFromRequest(context, staff);
    if (!period) return serviceResult(400, { message: "Enter a valid payroll start and end date within a 12 month range" });
    const scope = await jobScope(context);
    const payoutPage = parsePage(context.query.payoutPage, 1, Number.MAX_SAFE_INTEGER);
    const payoutLimit = parsePage(context.query.payoutLimit, 25, 100);
    const [preview, payoutTotal, payouts] = await Promise.all([
      buildStaffPayrollPreview(staff, period.periodStart, period.periodEnd, scope),
      StaffPayroll.countDocuments({ staff: staff._id }),
      StaffPayroll.find({ staff: staff._id }).select("-tenantId -recordedBy")
        .sort({ paymentDate: -1, createdAt: -1 }).skip((payoutPage - 1) * payoutLimit).limit(payoutLimit).lean(),
    ]);
    return serviceResult(200, {
      success: true,
      staff: {
        _id: staff._id,
        name: [staff.firstName, staff.lastName].filter(Boolean).join(" ") || "User",
        email: staff.email || "",
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
      payoutPaginationInfo: {
        totalResult: payoutTotal,
        totalPages: Math.ceil(payoutTotal / payoutLimit),
        currentPage: payoutPage,
        pageSize: payoutLimit,
      },
    });
  } catch (error) {
    return serviceResult(400, { message: errorMessage(error) });
  }
};

export const recordStaffPayroll = async (context: ServiceContext<PayrollInput, { staffId: string }>) => {
  const { periodStart: startValue, periodEnd: endValue, paymentDate, method, referenceNumber = "" } = context.body || {};
  const periodStart = parsePayrollDay(startValue);
  const periodEnd = parsePayrollDay(endValue, true);
  const parsedPaymentDate = typeof paymentDate === "string" ? new Date(paymentDate) : null;
  const validMethods = ["Cash", "Bank Transfer", "Card", "Cheque", "Other"];
  if (!periodStart || !periodEnd || periodStart > periodEnd || periodEnd.getTime() - periodStart.getTime() > 366 * 86400000) {
    return serviceResult(400, { message: "Enter a valid payroll period within a 12 month range" });
  }
  if (!parsedPaymentDate || Number.isNaN(parsedPaymentDate.getTime())) return serviceResult(400, { message: "A valid payment date is required" });
  if (!validMethods.includes(method)) return serviceResult(400, { message: "Select a valid payment method" });
  if (typeof referenceNumber !== "string" || referenceNumber.length > 120) {
    return serviceResult(400, { message: "Reference must be text with no more than 120 characters" });
  }

  try {
    const staff = await findPayrollStaff(context);
    if (!staff) return serviceResult(404, { message: "Staff member not found" });
    const scope = await jobScope(context);
    const preview = await buildStaffPayrollPreview(staff, periodStart, periodEnd, scope);
    if (!preview.entries.length || preview.totalAmount <= 0) {
      return serviceResult(409, { message: "There is no unpaid completed work in this period" });
    }

    const payout = new StaffPayroll({
      staff: staff._id,
      tenantId: staff.tenantId,
      payeeName: [staff.firstName, staff.lastName].filter(Boolean).join(" ") || "User",
      payeeEmail: staff.email || "",
      payeePhoneNumber: staff.phoneNumber || "",
      payFrequency: staff.payFrequency || "Weekly",
      periodStart,
      periodEnd,
      paymentDate: parsedPaymentDate,
      method,
      referenceNumber: referenceNumber.trim(),
      amount: preview.totalAmount,
      entries: preview.entries,
      recordedBy: context.user._id,
    });
    payout.receiptNumber = `CC-PAY-${String(payout._id).slice(-8).toUpperCase()}`;
    await payout.save();

    // The payroll document is the authoritative receipt ledger. These job updates keep the
    // existing job screens' paid status in sync; a failed projection cannot lose the payout.
    let projectionSyncPending = false;
    const jobsById = new Map<string, PayrollPreviewLine[]>();
    for (const entry of preview.entries) {
      const key = String(entry.jobId);
      const jobEntries = jobsById.get(key) || [];
      jobEntries.push(entry);
      jobsById.set(key, jobEntries);
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
              payoutAmount: 0,
              payoutReceiptCredit: 0,
              payoutBatchId: null,
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
    return serviceResult(201, {
      success: true,
      message: "Staff payroll recorded successfully",
      payout: payout.toObject(),
      projectionSyncPending,
    });
  } catch (error) {
    if (errorCode(error) === 11000) return serviceResult(409, { message: "One or more shifts in this period have already been paid. Refresh the payroll preview." });
    if (errorName(error) === "VersionError" || errorCode(error) === 112) return serviceResult(409, { message: "Payroll data changed while this payout was being recorded. Refresh and try again." });
    const status = errorStatus(error);
    if (status) return serviceResult(status, { message: errorMessage(error) });
    if (errorName(error) === "ValidationError") return serviceResult(400, { message: errorMessage(error) });
    throw error;
  }
};
