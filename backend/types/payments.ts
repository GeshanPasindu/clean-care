import type { Types } from "mongoose";
import type { Entity, PayrollLine } from "./models.js";
import type { PaymentMethod } from "./domain.js";
import { payFrequencies } from "./domain.js";

export const payoutFrequencies = payFrequencies;
export type PayoutFrequency = (typeof payoutFrequencies)[number];
export interface SalaryPlanRecord extends Entity {
  employee: Types.ObjectId;
  amount: number;
  frequency: "Weekly" | "Monthly";
  effectiveFrom: Date;
  updatedBy: Types.ObjectId;
}
export interface EmployeePaymentRecord extends Entity {
  employee: Types.ObjectId;
  tenantId: Types.ObjectId | null;
  employeeScope: "staff" | "tenant";
  payeeName: string;
  payeeEmail: string;
  kind: "Work" | "Salary";
  frequency: PayoutFrequency;
  periodStart: Date;
  periodEnd: Date;
  jobId?: Types.ObjectId;
  amount: number;
  entries: PayrollLine[];
  workKeys?: string[];
  salaryPeriodKey?: string;
  status: "Pending" | "Paid";
  receiptNumber?: string;
  paymentDate?: Date;
  method?: PaymentMethod;
  referenceNumber: string;
  preparedBy: Types.ObjectId;
  paidBy?: Types.ObjectId;
  paidAt?: Date;
  jobTotalsPending?: boolean;
}
