import type { PayrollLine } from "./models.js";

export interface PayrollPeriod {
  periodStart: Date;
  periodEnd: Date;
}
export interface PayrollPreviewLine extends PayrollLine {
  signInTime: Date;
  signOffTime: Date;
}
export interface PayrollPreview {
  entries: PayrollPreviewLine[];
  totalHours: number;
  totalAmount: number;
}
export interface FinancialSummary {
  totalOrgTotal: number;
  totalStaffPayTotal: number;
  totalReceived: number;
  totalProfit: number;
}
export interface PaymentSummary {
  totalPayment: number;
}
export interface TimesheetRow {
  id: string;
  jobId: string;
  jobName: string;
  jobDate?: Date;
  staffId: string;
  staffName: string;
  signInTime: Date;
  signOffTime: Date | null;
  hours: number;
  description: string;
}
