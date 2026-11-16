import mongoose from "mongoose";
import type { SalaryPlanRecord } from "../types/payments.js";
const { Schema } = mongoose;
const schema = new Schema<SalaryPlanRecord>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    frequency: { type: String, enum: ["Weekly", "Monthly"], required: true },
    effectiveFrom: { type: Date, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);
export default mongoose.model<SalaryPlanRecord>("SalaryPlan", schema);
