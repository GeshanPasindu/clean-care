import type { UserValues } from "../validation/forms";
export type CreateUserInput = Omit<
  UserValues,
  "roleId" | "tenantId" | "bankAcNo" | "bankName" | "bankAcBranch"
> &
  Partial<
    Pick<
      UserValues,
      "roleId" | "tenantId" | "bankAcNo" | "bankName" | "bankAcBranch"
    >
  >;
export type UpdateUserInput = Partial<
  Omit<CreateUserInput, "password" | "roleId" | "tenantId">
>;
export type AttendanceAction = "signInJob" | "signOffJob";
export interface AttendanceInput {
  staffId?: string;
  description?: string;
}
