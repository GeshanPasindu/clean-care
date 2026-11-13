import type { HydratedDocument, Types } from "mongoose";
import type {
  AccountStatus,
  JobStatus,
  PaymentMethod,
  PaymentStatus,
  PayFrequency,
  RoleScope,
} from "./domain.js";

export interface Entity {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
export interface RoleRecord extends Entity {
  key: string;
  name: string;
  description: string;
  scope: RoleScope;
  isSystem: boolean;
  isActive: boolean;
}
export interface PermissionRecord extends Entity {
  key: string;
  name: string;
  description: string;
  group: string;
  isSystem: boolean;
  platformOnly: boolean;
}
export interface RolePermissionRecord extends Entity {
  role: Types.ObjectId;
  permission: Types.ObjectId | PermissionRecord;
  grantedBy: Types.ObjectId | null;
}
export interface UserIdentity {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  userName?: string;
  phoneNumber?: string;
}
export type UserReference = Types.ObjectId | UserIdentity;
export interface UserRecord extends Entity, UserIdentity {
  userName: string;
  password: string;
  email: string;
  role: Types.ObjectId | RoleRecord;
  status: AccountStatus;
  address: string;
  phoneNumber: string;
  dateOfBirth: Date | null;
  position: string;
  dateOfHire: Date | null;
  empContactName: string;
  empPhoneNumber: string;
  bankAcNo: string;
  bankName: string;
  bankAcBranch: string;
  payFrequency: PayFrequency;
  notes: string;
  activeJob: Types.ObjectId | null;
  tenantId: Types.ObjectId | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}
export type UserDocument = HydratedDocument<UserRecord>;
export interface UserView extends Omit<
  UserRecord,
  "password" | "role" | "tenantId" | "bankAcNo" | "bankName" | "bankAcBranch"
> {
  roleId: string;
  role: string;
  roleName: string;
  scope: RoleScope;
  isPlatformAdmin: boolean;
  tenantId: string | null;
  supervisorName?: string;
  permissions?: string[];
  bankAcNo?: string;
  bankName?: string;
  bankAcBranch?: string;
}
export interface ClientContact {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
}
export interface ClientRecord extends Entity, ClientContact {
  email: string;
  address: string;
  phoneNumber: string;
  tenantId: Types.ObjectId;
  clientStatus: AccountStatus;
  contactName?: string;
  contactPhoneNumber?: string;
  contactEmail?: string;
  accountManager?: string;
  notes?: string;
}
export interface InvoiceRecord extends Entity {
  invoiceTitle: string;
  invoiceDescription: string;
  sendDate?: Date;
  client: Types.ObjectId | ClientRecord;
  amount?: number;
  notes?: string;
  invoiceStatus: PaymentStatus;
}
export interface TimeEntry {
  signInTime?: Date | null;
  signOffTime?: Date | null;
  description: string;
  hours: number;
  hourRate?: number;
  payoutAmount: number;
  payoutReceiptCredit: number;
  payoutBatchId: Types.ObjectId | null;
}
export interface PaymentReceipt {
  _id?: Types.ObjectId;
  amount: number;
  paymentDate: Date;
  method: PaymentMethod;
  referenceNumber: string;
  recordedBy: Types.ObjectId;
  jobName: string;
  jobDate?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}
export interface StaffPaymentReceipt extends PaymentReceipt {
  payeeName: string;
  payeeEmail: string;
  payeePhoneNumber: string;
  hours: number;
  hourRate: number;
}
export interface ClientPaymentReceipt extends PaymentReceipt {
  clientName: string;
  clientEmail: string;
  clientPhoneNumber: string;
  clientAddress: string;
}
export interface StaffAssignment {
  staff: UserReference;
  isAssigned: boolean;
  estimatedHours: number;
  hourRate: number;
  estimatedPayment: number;
  hours: number;
  payment: number;
  paymentStatus: PaymentStatus;
  payoutReceipts: StaffPaymentReceipt[];
  signInTime?: Date | null;
  signOffTime?: Date | null;
  timeEntries: TimeEntry[];
  isSignIn: boolean;
  isSignOff: boolean;
  payoutBatchTotal?: number;
}
export interface JobRecord extends Entity {
  jobName: string;
  description: string;
  client: Types.ObjectId | ClientContact;
  assignedStaff: UserReference[];
  staffAssignments: StaffAssignment[];
  receivedPayments: ClientPaymentReceipt[];
  tenantId: Types.ObjectId;
  jobStatus: JobStatus;
  notes?: string;
  jobDate?: Date;
  orgNoOfhours?: number;
  orgHourRate?: number;
  orgTotal?: number;
  estNoOfhours?: number;
  staffHourRate?: number;
  staffPayTotal?: number;
  staffHoursTotal?: number;
  staffPaymentTotal?: number;
  noOfhours?: number;
  hourRate?: number;
  payment?: number;
  paymentStatus?: PaymentStatus;
  signInTime?: Date | null;
  signOffTime?: Date | null;
  isSignIn: boolean;
  isSignOff: boolean;
}
export type JobDocument = HydratedDocument<JobRecord>;
export interface AssignmentView {
  staff: UserReference;
  signInTime?: Date | null;
  signOffTime?: Date | null;
  isSignIn: boolean;
  isSignOff: boolean;
  hours: number;
  hourRate: number;
  payment: number;
  paymentStatus: PaymentStatus;
  payoutReceipts: StaffPaymentReceipt[];
  payoutBatchTotal: number;
  timeEntries: Pick<
    TimeEntry,
    "signInTime" | "signOffTime" | "hours" | "description"
  >[];
}
export interface JobView extends Omit<
  JobRecord,
  "staffAssignments" | "tenantId" | "receivedPayments"
> {
  staffAssignments?: StaffAssignment[];
  tenantId?: Types.ObjectId;
  receivedPayments?: ClientPaymentReceipt[];
  currentStaffAssignment?: AssignmentView | null;
  staffAssignment?: StaffAssignment | AssignmentView | null;
}
export interface PayrollLine {
  jobId: Types.ObjectId;
  timeEntryIndex: number;
  jobName: string;
  jobDate?: Date;
  signInTime?: Date | null;
  signOffTime?: Date | null;
  description: string;
  hours: number;
  hourRate: number;
  amount: number;
  receiptCreditApplied: number;
}
export interface StaffPayrollRecord extends Entity {
  receiptNumber: string;
  staff: Types.ObjectId;
  tenantId: Types.ObjectId;
  payeeName: string;
  payeeEmail: string;
  payeePhoneNumber: string;
  payFrequency: PayFrequency;
  periodStart: Date;
  periodEnd: Date;
  paymentDate: Date;
  method: PaymentMethod;
  referenceNumber: string;
  amount: number;
  entries: PayrollLine[];
  recordedBy: Types.ObjectId;
}
export interface RefreshSessionRecord extends Entity {
  user: Types.ObjectId;
  familyId: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  userAgent?: string;
  ipAddress?: string;
  lastUsedAt: Date;
}
export interface RefreshTokenRecord extends Entity {
  session: Types.ObjectId;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
}
export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}
export interface SessionResult {
  user: import("./domain.js").AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}
