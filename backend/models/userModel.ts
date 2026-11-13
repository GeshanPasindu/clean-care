import { accountStatuses, payFrequencies } from "../types/domain.js";
import type { UserRecord } from "../types/models.js";
import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema<UserRecord>({
  userName: { type: String, required: true, trim: true, maxlength: 120 },
  password: { type: String, required: true, select: false },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  role: { type: Schema.Types.ObjectId, ref: "Role", required: true, index: true },
  status: { type: String, enum: [...accountStatuses], default: "active", required: true },
  firstName: { type: String, trim: true, maxlength: 100, default: "" },
  lastName: { type: String, trim: true, maxlength: 100, default: "" },
  address: { type: String, trim: true, maxlength: 500, default: "" },
  phoneNumber: { type: String, trim: true, maxlength: 40, default: "" },
  dateOfBirth: { type: Date, default: null },
  position: { type: String, trim: true, maxlength: 120, default: "" },
  dateOfHire: { type: Date, default: null },
  empContactName: { type: String, trim: true, maxlength: 160, default: "" },
  empPhoneNumber: { type: String, trim: true, maxlength: 40, default: "" },
  bankAcNo: { type: String, trim: true, maxlength: 80, default: "" },
  bankName: { type: String, trim: true, maxlength: 120, default: "" },
  bankAcBranch: { type: String, trim: true, maxlength: 120, default: "" },
  payFrequency: { type: String, enum: [...payFrequencies], default: "Weekly", required: true },
  notes: { type: String, trim: true, maxlength: 2000, default: "" },
  activeJob: { type: Schema.Types.ObjectId, ref: "Job", default: null },
  tenantId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  isDeleted: { type: Boolean, default: false, required: true, index: true },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

const User = mongoose.model<UserRecord>("User", userSchema);
export default User;
