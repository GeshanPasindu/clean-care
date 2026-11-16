import mongoose from "mongoose";
import type { EmployeePaymentRecord } from "../types/payments.js";
import type { PayrollLine } from "../types/models.js";
import { payoutFrequencies } from "../types/payments.js";
import { paymentMethods } from "../types/domain.js";
const { Schema } = mongoose;
const lineSchema = new Schema<PayrollLine>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    timeEntryIndex: { type: Number, required: true, min: 0 },
    jobName: { type: String, required: true },
    jobDate: Date,
    signInTime: Date,
    signOffTime: Date,
    description: { type: String, default: "" },
    hours: { type: Number, min: 0, required: true },
    hourRate: { type: Number, min: 0, required: true },
    amount: { type: Number, min: 0, required: true },
    receiptCreditApplied: { type: Number, default: 0 },
  },
  { _id: false },
);
const schema = new Schema<EmployeePaymentRecord>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    employeeScope: { type: String, enum: ["staff", "tenant"], required: true },
    payeeName: { type: String, required: true },
    payeeEmail: { type: String, default: "" },
    kind: { type: String, enum: ["Work", "Salary"], required: true },
    frequency: { type: String, enum: [...payoutFrequencies], required: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job" },
    amount: { type: Number, min: 0.01, required: true },
    entries: { type: [lineSchema], default: [] },
    workKeys: { type: [String], default: undefined },
    salaryPeriodKey: String,
    status: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
      required: true,
    },
    receiptNumber: String,
    paymentDate: Date,
    method: { type: String, enum: [...paymentMethods] },
    referenceNumber: { type: String, maxlength: 120, default: "" },
    preparedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    paidBy: { type: Schema.Types.ObjectId, ref: "User" },
    paidAt: Date,
    jobTotalsPending: { type: Boolean, default: false },
  },
  { timestamps: true },
);
// A completed shift can be reserved or paid only once, regardless of payout frequency.
schema.index({ workKeys: 1 }, { unique: true, sparse: true });
schema.index({ salaryPeriodKey: 1 }, { unique: true, sparse: true });
schema.index({ employee: 1, status: 1, createdAt: -1 });
schema.index({ employeeScope: 1, tenantId: 1, createdAt: -1 });
export default mongoose.model<EmployeePaymentRecord>("EmployeePayment", schema);
