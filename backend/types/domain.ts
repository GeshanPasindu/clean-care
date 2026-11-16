import type { Types } from "mongoose";

export const roleScopes = ["platform", "tenant", "staff"] as const;
export const accountStatuses = ["active", "inactive"] as const;
export const jobStatuses = ["InProgress", "Completed", "Cancelled"] as const;
export const paymentStatuses = ["Pending", "Done"] as const;
export const paymentMethods = [
  "Cash",
  "Bank Transfer",
  "Card",
  "Cheque",
  "Other",
] as const;
export const payFrequencies = ["Daily", "PerJob", "Weekly", "Monthly"] as const;
export type RoleScope = (typeof roleScopes)[number];
export type AccountStatus = (typeof accountStatuses)[number];
export type JobStatus = (typeof jobStatuses)[number];
export type PaymentStatus = (typeof paymentStatuses)[number];
export type PaymentMethod = (typeof paymentMethods)[number];
export type PayFrequency = (typeof payFrequencies)[number];
export type EntityId = string | Types.ObjectId;
export type IdReference = EntityId | { _id: EntityId };

export interface PaginationInfo {
  totalResult: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

export interface ServiceResult<T = unknown> {
  statusCode: number;
  body: T;
}

export interface AuthenticatedUser {
  id: string;
  _id: string;
  userName: string;
  email: string;
  role: string;
  roleId: string;
  roleName: string;
  scope: RoleScope;
  isPlatformAdmin: boolean;
  permissions: string[];
  status: AccountStatus;
  firstName: string;
  lastName: string;
  address: string;
  phoneNumber: string;
  dateOfBirth: Date | null;
  position: string;
  tenantId: string | null;
  supervisor: { id: string; name: string } | null;
  supervisorName: string;
  isDeleted: boolean;
}

export interface ActorContext {
  user: AuthenticatedUser;
}
export interface ServiceContext<
  Body = Record<string, never>,
  Params = Record<string, never>,
  Query = Record<string, never>,
> extends ActorContext {
  body: Body;
  params: Params;
  query: Query;
}

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}
