import mongoose from "mongoose";

const { Schema } = mongoose;

const payrollLineSchema = new Schema({
  jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
  timeEntryIndex: { type: Number, required: true, min: 0 },
  jobName: { type: String, trim: true, maxlength: 160, default: "" },
  jobDate: Date,
  signInTime: Date,
  signOffTime: Date,
  description: { type: String, trim: true, maxlength: 1000, default: "" },
  hours: { type: Number, required: true, min: 0 },
  hourRate: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  receiptCreditApplied: { type: Number, default: 0, min: 0 },
}, { _id: false });

const staffPayrollSchema = new Schema({
  receiptNumber: { type: String, required: true, unique: true, trim: true, maxlength: 40 },
  staff: { type: Schema.Types.ObjectId, ref: "Staff", required: true, index: true },
  adminId: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
  payeeName: { type: String, required: true, trim: true, maxlength: 160 },
  payeeEmail: { type: String, trim: true, maxlength: 254, default: "" },
  payeePhoneNumber: { type: String, trim: true, maxlength: 40, default: "" },
  payFrequency: { type: String, enum: ["Weekly", "Monthly"], required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  paymentDate: { type: Date, required: true },
  method: { type: String, enum: ["Cash", "Bank Transfer", "Card", "Cheque", "Other"], required: true },
  referenceNumber: { type: String, trim: true, maxlength: 120, default: "" },
  amount: { type: Number, required: true, min: 0.01 },
  entries: { type: [payrollLineSchema], required: true, validate: (value) => Array.isArray(value) && value.length > 0 },
  recordedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

staffPayrollSchema.index({ staff: 1, periodStart: 1, periodEnd: 1 }, { unique: true });
staffPayrollSchema.index({ staff: 1, "entries.jobId": 1, "entries.timeEntryIndex": 1 }, { unique: true });
staffPayrollSchema.index({ staff: 1, paymentDate: -1 });

export default mongoose.model("StaffPayroll", staffPayrollSchema);
