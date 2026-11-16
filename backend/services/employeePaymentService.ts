import mongoose, { type FilterQuery, type PipelineStage } from "mongoose";
import EmployeePayment from "../models/employeePaymentModel.js";
import SalaryPlan from "../models/salaryPlanModel.js";
import StaffPayroll from "../models/staffPayrollModel.js";
import User from "../models/userModel.js";
import Role from "../models/roleModel.js";
import Job from "../models/jobModel.js";
import type { AuthenticatedUser, EntityId } from "../types/domain.js";
import type {
  RoleRecord,
  JobRecord,
  PayrollLine,
  UserRecord,
} from "../types/models.js";
import type { EmployeePaymentRecord } from "../types/payments.js";
import type {
  PreparePaymentInput,
  SalaryPlanInput,
  MarkPaidInput,
  EmployeeListQuery,
  PaymentListQuery,
} from "../types/requests.js";
import { ServiceError } from "./serviceError.js";
import {
  assertPaymentAccess,
  paymentPermission,
  type PaymentAction,
} from "./paymentAccessService.js";
import { jobScope } from "./authorizationService.js";
import { buildStaffPayrollPreview } from "./jobService.js";
import { paymentPeriod, paymentDay } from "../utils/paymentPeriods.js";
import { referenceId } from "../utils/references.js";
import { errorCode } from "../utils/errors.js";

const oid = (id: EntityId) => new mongoose.Types.ObjectId(id);
const nameOf = (
  user: Pick<UserRecord, "firstName" | "lastName" | "userName">,
) => [user.firstName, user.lastName].filter(Boolean).join(" ") || user.userName;
const pagination = (totalResult: number, page: number, limit: number) => ({
  totalResult,
  totalPages: Math.ceil(totalResult / limit),
  currentPage: page,
  pageSize: limit,
});
const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lineKey = (line: PayrollLine) =>
  `${String(line.jobId)}:${line.timeEntryIndex}`;
const publicEntries = (entries: PayrollLine[]) =>
  entries.map(
    ({
      jobId: _jobId,
      timeEntryIndex: _index,
      receiptCreditApplied: _credit,
      ...entry
    }) => entry,
  );
const legacyProjection = {
  employee: "$staff",
  employeeScope: "staff",
  kind: "Work",
  frequency: "$payFrequency",
  status: "Paid",
  jobTotalsPending: false,
};
function salaryDayKeys(employeeId: string, start: Date, end: Date): string[] {
  const keys: string[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += 86_400_000)
    keys.push(`salary:${employeeId}:${paymentDay(new Date(time))}`);
  return keys;
}
function present(payment: EmployeePaymentRecord) {
  return {
    _id: String(payment._id),
    employeeId: String(payment.employee),
    employeeScope: payment.employeeScope,
    payeeName: payment.payeeName,
    payeeEmail: payment.payeeEmail,
    kind: payment.kind,
    frequency: payment.frequency,
    periodStart: paymentDay(payment.periodStart),
    periodEnd: paymentDay(payment.periodEnd),
    jobId: payment.jobId ? String(payment.jobId) : undefined,
    amount: payment.amount,
    entries: publicEntries(payment.entries),
    status: payment.status,
    receiptNumber: payment.receiptNumber,
    paymentDate: payment.paymentDate
      ? paymentDay(payment.paymentDate)
      : undefined,
    method: payment.method,
    referenceNumber: payment.referenceNumber,
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    jobTotalsPending:
      payment.kind === "Work" &&
      payment.status === "Paid" &&
      (payment.jobTotalsPending ?? true),
  };
}
function managerScope(
  actor: AuthenticatedUser,
  scope: "staff" | "tenant",
  action: PaymentAction,
): FilterQuery<EmployeePaymentRecord> {
  if (
    actor.scope === "staff" ||
    !actor.permissions.includes(paymentPermission(scope, action))
  )
    throw new ServiceError("Access denied", 403);
  return {
    employeeScope: scope,
    employee: { $ne: oid(actor._id) },
    ...(scope === "staff" && actor.scope !== "platform"
      ? { tenantId: oid(actor.tenantId || actor._id) }
      : {}),
  };
}
async function employeeTarget(
  id: string,
  actor: AuthenticatedUser,
  action: PaymentAction,
  existingPayment = false,
) {
  const employee = await User.findOne({
    _id: id,
    ...(!existingPayment ? { isDeleted: false } : {}),
  })
    .select(
      "_id userName firstName lastName email tenantId role status payFrequency",
    )
    .populate<{ role: RoleRecord }>("role", "scope isActive");
  if (!employee?.role) throw new ServiceError("Employee not found", 404);
  assertPaymentAccess(
    actor,
    {
      _id: employee._id,
      scope: employee.role.scope,
      tenantId: employee.tenantId,
    },
    action,
  );
  if (
    !existingPayment &&
    action !== "read" &&
    (employee.status !== "active" || !employee.role.isActive)
  )
    throw new ServiceError(
      "Payments require an active employee account and role",
      409,
    );
  return employee;
}
async function preview(
  input: PreparePaymentInput,
  actor: AuthenticatedUser,
  excludePaymentId?: EntityId,
) {
  const employee = await employeeTarget(
    input.employeeId,
    actor,
    "record",
    Boolean(excludePaymentId),
  );
  if (employee.role.scope === "tenant") {
    const plan = await SalaryPlan.findOne({ employee: employee._id }).lean();
    if (!plan)
      throw new ServiceError("Configure this supervisor's salary first", 400);
    if (input.frequency !== plan.frequency)
      throw new ServiceError(
        `This supervisor has a ${plan.frequency.toLowerCase()} salary`,
        400,
      );
    const period = paymentPeriod(input.date, plan.frequency);
    if (period.periodStart < plan.effectiveFrom)
      throw new ServiceError(
        "Choose a full salary period starting on or after the effective date",
        400,
      );
    if (
      await EmployeePayment.exists({
        employee: employee._id,
        kind: "Salary",
        periodStart: { $lte: period.periodEnd },
        periodEnd: { $gte: period.periodStart },
        ...(excludePaymentId ? { _id: { $ne: excludePaymentId } } : {}),
      })
    )
      throw new ServiceError(
        "This salary period overlaps a pending or paid payment",
        409,
      );
    return {
      employee,
      ...period,
      entries: [],
      amount: plan.amount,
      kind: "Salary" as const,
      frequency: plan.frequency,
      jobId: undefined,
    };
  }
  let scope: FilterQuery<JobRecord> = await jobScope({ user: actor });
  let period: { periodStart: Date; periodEnd: Date };
  if (input.frequency === "PerJob") {
    const job = await Job.findOne({
      $and: [
        scope,
        {
          _id: input.jobId,
          jobStatus: "Completed",
          $or: [
            { assignedStaff: employee._id },
            { "staffAssignments.staff": employee._id },
          ],
        },
      ],
    }).select("_id");
    if (!job)
      throw new ServiceError(
        "Choose a completed job assigned to this cleaner",
        400,
      );
    scope = { $and: [scope, { _id: job._id }] };
    period = {
      periodStart: new Date("1970-01-01"),
      periodEnd: new Date("2200-01-01"),
    };
  } else period = paymentPeriod(input.date, input.frequency);
  const work = await buildStaffPayrollPreview(
    employee,
    period.periodStart,
    period.periodEnd,
    scope,
    excludePaymentId,
  );
  if (!work.entries.length || work.totalAmount <= 0)
    throw new ServiceError(
      "No unpaid completed work is available for this selection",
      409,
    );
  if (input.frequency === "PerJob")
    period = {
      periodStart: new Date(
        Math.min(...work.entries.map((entry) => entry.signInTime.getTime())),
      ),
      periodEnd: new Date(
        Math.max(...work.entries.map((entry) => entry.signOffTime.getTime())),
      ),
    };
  return {
    employee,
    ...period,
    entries: work.entries,
    amount: work.totalAmount,
    kind: "Work" as const,
    frequency: input.frequency,
    jobId: input.jobId,
  };
}
async function paymentTarget(
  id: string,
  actor: AuthenticatedUser,
  action: PaymentAction,
) {
  const payment = await EmployeePayment.findById(id);
  if (!payment) throw new ServiceError("Payment not found", 404);
  await employeeTarget(String(payment.employee), actor, action, true);
  // Check the ownership snapshot as well, in case the employee has changed supervisor.
  assertPaymentAccess(
    actor,
    {
      _id: payment.employee,
      scope: payment.employeeScope,
      tenantId: payment.tenantId,
    },
    action,
  );
  return payment;
}
async function syncJobs(payment: EmployeePaymentRecord) {
  let syncPending = false;
  for (const jobId of new Set(
    payment.entries.map((entry) => String(entry.jobId)),
  )) {
    try {
      const job = await Job.findById(jobId);
      const assignment = job?.staffAssignments.find(
        (item) => referenceId(item.staff) === String(payment.employee),
      );
      if (!job || !assignment) {
        syncPending = true;
        continue;
      }
      for (const entry of payment.entries.filter(
        (item) => String(item.jobId) === jobId,
      )) {
        const shift = assignment.timeEntries[entry.timeEntryIndex];
        if (!shift) {
          syncPending = true;
          continue;
        }
        shift.payoutAmount = entry.amount;
        shift.payoutReceiptCredit = entry.receiptCreditApplied;
        shift.payoutBatchId = payment._id;
      }
      const paid =
        assignment.payoutReceipts.reduce(
          (sum, receipt) => sum + Math.round(receipt.amount * 100),
          0,
        ) +
        assignment.timeEntries.reduce(
          (sum, entry) => sum + Math.round(entry.payoutAmount * 100),
          0,
        );
      assignment.paymentStatus =
        paid >= Math.round(assignment.payment * 100) ? "Done" : "Pending";
      job.paymentStatus = job.staffAssignments
        .filter((item) => item.isAssigned !== false)
        .every((item) => item.paymentStatus === "Done")
        ? "Done"
        : "Pending";
      await job.save();
    } catch {
      syncPending = true;
    }
  }
  return syncPending;
}

async function synchronizePaidPayment(payment: EmployeePaymentRecord) {
  if (payment.kind !== "Work")
    return { payment: present(payment), syncPending: false };
  let syncPending = await syncJobs(payment);
  try {
    await EmployeePayment.updateOne(
      { _id: payment._id, status: "Paid" },
      { $set: { jobTotalsPending: syncPending } },
      { timestamps: false },
    );
  } catch {
    // The paid receipt remains saved; retain the retry indicator if updating it failed.
    syncPending = true;
  }
  payment.jobTotalsPending = syncPending;
  return { payment: present(payment), syncPending };
}

export const employeePaymentService = {
  async jobs(
    employeeId: string,
    query: Pick<PaymentListQuery, "page" | "limit">,
    actor: AuthenticatedUser,
  ) {
    const employee = await employeeTarget(employeeId, actor, "read");
    if (employee.role.scope !== "staff")
      throw new ServiceError("Only cleaners have payable jobs", 400);
    const filter = {
      $and: [
        await jobScope({ user: actor }),
        {
          jobStatus: "Completed",
          $or: [
            { assignedStaff: employee._id },
            { "staffAssignments.staff": employee._id },
          ],
        },
      ],
    };
    const [total, jobs] = await Promise.all([
      Job.countDocuments(filter),
      Job.find(filter)
        .select("_id jobName jobDate")
        .sort({ jobDate: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
    ]);
    return {
      jobs: jobs.map((job) => ({
        _id: String(job._id),
        name: job.jobName,
        date: job.jobDate,
      })),
      paginationInfo: pagination(total, query.page, query.limit),
    };
  },
  async employees(query: EmployeeListQuery, actor: AuthenticatedUser) {
    managerScope(actor, query.scope, "read");
    const roles = await Role.find({ scope: query.scope }).select("_id").lean();
    const filter: FilterQuery<UserRecord> = {
      role: { $in: roles.map((role) => role._id) },
      isDeleted: false,
      _id: { $ne: actor._id },
      ...(query.scope === "staff" && actor.scope !== "platform"
        ? { tenantId: actor.tenantId || actor._id }
        : {}),
    };
    if (query.search) {
      const search = { $regex: escapeRegex(query.search), $options: "i" };
      filter.$or = [
        { firstName: search },
        { lastName: search },
        { userName: search },
        { email: search },
      ];
    }
    const [total, users] = await Promise.all([
      User.countDocuments(filter),
      User.find(filter)
        .select("_id userName firstName lastName email status payFrequency")
        .sort({ firstName: 1, _id: 1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean(),
    ]);
    const plans =
      query.scope === "tenant"
        ? await SalaryPlan.find({
            employee: { $in: users.map((user) => user._id) },
          }).lean()
        : [];
    return {
      employees: users.map((user) => {
        const plan = plans.find(
          (item) => String(item.employee) === String(user._id),
        );
        return {
          _id: String(user._id),
          name: nameOf(user),
          email: user.email,
          scope: query.scope,
          status: user.status,
          frequency: plan?.frequency || user.payFrequency,
          salary: plan
            ? {
                amount: plan.amount,
                frequency: plan.frequency,
                effectiveFrom: paymentDay(plan.effectiveFrom),
              }
            : null,
        };
      }),
      paginationInfo: pagination(total, query.page, query.limit),
    };
  },
  async list(query: PaymentListQuery, actor: AuthenticatedUser) {
    const filter = managerScope(actor, query.scope, "read");
    if (query.employeeId) {
      await employeeTarget(query.employeeId, actor, "read");
      filter.employee = oid(query.employeeId);
    }
    if (query.status) filter.status = query.status;
    const pipeline: PipelineStage[] = [{ $match: filter }];
    if (query.scope === "staff" && query.status !== "Pending") {
      const oldFilter = {
        staff: query.employeeId
          ? oid(query.employeeId)
          : { $ne: oid(actor._id) },
        ...(actor.scope !== "platform"
          ? { tenantId: oid(actor.tenantId || actor._id) }
          : {}),
      };
      pipeline.push({
        $unionWith: {
          coll: StaffPayroll.collection.name,
          pipeline: [{ $match: oldFilter }, { $set: legacyProjection }],
        },
      });
    }
    pipeline.push(
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          payments: [
            { $skip: (query.page - 1) * query.limit },
            { $limit: query.limit },
          ],
          total: [{ $count: "count" }],
        },
      },
    );
    const [result] = await EmployeePayment.aggregate<{
      payments: EmployeePaymentRecord[];
      total: { count: number }[];
    }>(pipeline);
    return {
      payments: (result?.payments || []).map(present),
      paginationInfo: pagination(
        result?.total[0]?.count || 0,
        query.page,
        query.limit,
      ),
    };
  },
  async salary(
    employeeId: string,
    input: SalaryPlanInput,
    actor: AuthenticatedUser,
  ) {
    const employee = await employeeTarget(employeeId, actor, "manage");
    if (employee.role.scope !== "tenant")
      throw new ServiceError("Fixed salary plans apply to supervisors", 400);
    const plan = await SalaryPlan.findOneAndUpdate(
      { employee: employee._id },
      {
        $set: {
          amount: input.amount,
          frequency: input.frequency,
          effectiveFrom: paymentPeriod(input.effectiveFrom, "Daily")
            .periodStart,
          updatedBy: actor._id,
        },
      },
      { new: true, upsert: true, runValidators: true },
    );
    return {
      salary: {
        amount: plan.amount,
        frequency: plan.frequency,
        effectiveFrom: paymentDay(plan.effectiveFrom),
      },
    };
  },
  async preview(input: PreparePaymentInput, actor: AuthenticatedUser) {
    const result = await preview(input, actor);
    return {
      preview: {
        payeeName: nameOf(result.employee),
        kind: result.kind,
        frequency: result.frequency,
        periodStart: paymentDay(result.periodStart),
        periodEnd: paymentDay(result.periodEnd),
        amount: result.amount,
        entries: publicEntries(result.entries),
      },
    };
  },
  async prepare(input: PreparePaymentInput, actor: AuthenticatedUser) {
    const result = await preview(input, actor);
    try {
      await EmployeePayment.init();
      const payment = await EmployeePayment.create({
        employee: result.employee._id,
        tenantId: result.employee.tenantId,
        employeeScope: result.employee.role.scope,
        payeeName: nameOf(result.employee),
        payeeEmail: result.employee.email,
        kind: result.kind,
        frequency: result.frequency,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
        amount: result.amount,
        entries: result.entries,
        jobId: result.jobId,
        preparedBy: actor._id,
        ...(result.kind === "Work"
          ? {
              workKeys: result.entries.map(
                (entry) => `${result.employee._id}:${lineKey(entry)}`,
              ),
            }
          : {
              salaryPeriodKey: `${result.employee._id}:${paymentDay(result.periodStart)}`,
              workKeys: salaryDayKeys(
                String(result.employee._id),
                result.periodStart,
                result.periodEnd,
              ),
            }),
      });
      return { payment: present(payment) };
    } catch (error) {
      if (errorCode(error) === 11000)
        throw new ServiceError(
          "This work or salary period already has a pending or paid payment. Refresh the list.",
          409,
        );
      throw error;
    }
  },
  async markPaid(id: string, input: MarkPaidInput, actor: AuthenticatedUser) {
    const payment = await paymentTarget(id, actor, "record");
    if (payment.status === "Paid") return synchronizePaidPayment(payment);
    if (payment.kind === "Work") {
      const current = await preview(
        {
          employeeId: String(payment.employee),
          frequency: payment.frequency,
          date: paymentDay(payment.periodStart),
          ...(payment.jobId ? { jobId: String(payment.jobId) } : {}),
        },
        actor,
        payment._id,
      );
      const byKey = new Map(
        current.entries.map((entry) => [lineKey(entry), entry]),
      );
      if (
        payment.entries.some((entry) => {
          const match = byKey.get(lineKey(entry));
          return (
            !match ||
            match.amount !== entry.amount ||
            match.hours !== entry.hours ||
            match.hourRate !== entry.hourRate
          );
        })
      )
        throw new ServiceError(
          "Work details changed. Cancel this pending payment and prepare it again.",
          409,
        );
    }
    const paid = await EmployeePayment.findOneAndUpdate(
      { _id: payment._id, status: "Pending" },
      {
        $set: {
          status: "Paid",
          paymentDate: paymentPeriod(input.paymentDate, "Daily").periodStart,
          method: input.method,
          referenceNumber: input.referenceNumber,
          paidBy: actor._id,
          paidAt: new Date(),
          receiptNumber: `CC-PAY-${String(payment._id).toUpperCase()}`,
          jobTotalsPending: payment.kind === "Work",
        },
      },
      { new: true, runValidators: true },
    );
    if (!paid)
      throw new ServiceError("Payment changed. Refresh the list.", 409);
    return synchronizePaidPayment(paid);
  },
  async synchronize(id: string, actor: AuthenticatedUser) {
    const payment = await paymentTarget(id, actor, "record");
    if (payment.status !== "Paid")
      throw new ServiceError(
        "Only paid payments have job totals to update",
        409,
      );
    return synchronizePaidPayment(payment);
  },
  async cancel(id: string, actor: AuthenticatedUser) {
    const payment = await paymentTarget(id, actor, "record");
    const deleted = await EmployeePayment.deleteOne({
      _id: payment._id,
      status: "Pending",
    });
    if (!deleted.deletedCount)
      throw new ServiceError("Paid receipts cannot be deleted or changed", 409);
  },
  async receipts(
    actor: AuthenticatedUser,
    query: Pick<PaymentListQuery, "page" | "limit">,
  ) {
    if (
      actor.scope === "platform" ||
      !actor.permissions.includes("payroll.self.read")
    )
      throw new ServiceError(
        "Personal payment history is not available for this account",
        403,
      );
    const filter = { employee: actor._id, status: "Paid" };
    const [newCount, oldCount] = await Promise.all([
      EmployeePayment.countDocuments(filter),
      StaffPayroll.countDocuments({ staff: actor._id }),
    ]);
    const offset = (query.page - 1) * query.limit;
    const pipeline: PipelineStage[] = [
      { $match: { employee: oid(actor._id), status: "Paid" } },
      {
        $unionWith: {
          coll: StaffPayroll.collection.name,
          pipeline: [
            { $match: { staff: oid(actor._id) } },
            { $set: legacyProjection },
          ],
        },
      },
      { $sort: { paymentDate: -1, _id: -1 } },
      { $skip: offset },
      { $limit: query.limit },
    ];
    const payments =
      await EmployeePayment.aggregate<EmployeePaymentRecord>(pipeline);
    return {
      payments: payments.map(present),
      paginationInfo: pagination(newCount + oldCount, query.page, query.limit),
    };
  },
};
